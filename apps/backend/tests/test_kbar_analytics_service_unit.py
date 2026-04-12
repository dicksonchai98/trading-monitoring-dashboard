from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.db.session import get_session
from app.models.kbar_1m import Kbar1mModel
from app.modules.kbar_analytics.service import (
    KbarAnalyticsService,
    _compute_histogram,
    _percentile,
)


def _seed_kbars(session, code: str = "TXF") -> None:
    base_dt = datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc)
    day_bases = [1000.0, 1140.0, 1010.0, 1210.0]
    rows: list[Kbar1mModel] = []
    for day_offset, open_value in enumerate(day_bases):
        trade_date = date(2026, 4, 1) + timedelta(days=day_offset)
        rows.extend(
            [
                Kbar1mModel(
                    code=code,
                    trade_date=trade_date,
                    minute_ts=base_dt + timedelta(days=day_offset, minutes=0),
                    open=open_value,
                    high=open_value + 10,
                    low=open_value - 10,
                    close=open_value + 2,
                    volume=10,
                ),
                Kbar1mModel(
                    code=code,
                    trade_date=trade_date,
                    minute_ts=base_dt + timedelta(days=day_offset, minutes=1),
                    open=open_value + 2,
                    high=open_value + 180,
                    low=open_value - 20,
                    close=open_value + 150,
                    volume=20,
                ),
            ]
        )
    session.add_all(rows)
    session.commit()


def test_percentile_and_histogram_are_deterministic() -> None:
    values = [1.0, 2.0, 3.0, 4.0]
    assert _percentile(values, 0.25) == 1.75
    assert _percentile(values, 0.5) == 2.5
    assert _percentile(values, 0.75) == 3.25

    hist = _compute_histogram(values, bins=2)
    assert hist["counts"] == [2, 2]
    assert len(hist["bins"]) == 3


def test_execute_job_with_retry_updates_retry_count() -> None:
    with get_session() as session:
        service = KbarAnalyticsService(session)
        job = service.create_job(job_type="recompute_event_stats", payload={"code": "TXF"})
        attempts = {"count": 0}

        def operation() -> dict[str, int]:
            attempts["count"] += 1
            if attempts["count"] == 1:
                raise TimeoutError("transient")
            return {"ok": 1}

        result = service.execute_job_with_retry(
            job=job, operation=operation, max_attempts=3, backoff_seconds=0
        )
        session.commit()
        assert result == {"ok": 1}
        assert job.status == "success"
        assert job.retry_count == 1


def test_execute_job_with_retry_marks_failed_for_non_recoverable_error() -> None:
    with get_session() as session:
        service = KbarAnalyticsService(session)
        job = service.create_job(job_type="recompute_event_stats", payload={"code": "TXF"})

        def operation() -> dict[str, int]:
            raise ValueError("bad-request")

        try:
            service.execute_job_with_retry(
                job=job, operation=operation, max_attempts=3, backoff_seconds=0
            )
        except ValueError:
            pass
        else:
            raise AssertionError("expected ValueError")
        session.commit()
        assert job.status == "failed"
        assert job.retry_count == 0


def test_deterministic_next_day_category_rule() -> None:
    with get_session() as session:
        _seed_kbars(session)
        service = KbarAnalyticsService(session)
        service.rebuild_daily_features(
            code="TXF", start_date=date(2026, 4, 1), end_date=date(2026, 4, 4)
        )
        service.recompute_event_stats(
            code="TXF",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 4),
            event_ids=["day_up_gt_100"],
        )
        session.commit()

        items, total = service.get_event_samples(
            event_id="day_up_gt_100",
            code="TXF",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 4),
            page=1,
            page_size=20,
            sort="trade_date",
        )
        assert total >= 1
        assert all(item.next_day_category in {"up", "down", "flat"} for item in items)
