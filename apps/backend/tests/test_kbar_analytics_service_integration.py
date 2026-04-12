from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.db.session import get_session
from app.models.kbar_1m import Kbar1mModel
from app.modules.kbar_analytics.service import KbarAnalyticsService


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


def test_end_to_end_pipeline_from_raw_kbars_to_stats() -> None:
    with get_session() as session:
        _seed_kbars(session, code="TXF")
        service = KbarAnalyticsService(session)

        rebuilt = service.rebuild_daily_features(
            code="TXF", start_date=date(2026, 4, 1), end_date=date(2026, 4, 4)
        )
        assert rebuilt["rows"] == 4

        event_result = service.recompute_event_stats(
            code="TXF",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 4),
            event_ids=["day_up_gt_100"],
        )
        assert event_result["stats"] >= 1

        distribution_result = service.recompute_distribution_stats(
            code="TXF",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 4),
            metric_ids=["day_return"],
        )
        assert distribution_result["stats"] == 1

        event_stats = service.get_event_stats(
            event_id="day_up_gt_100",
            code="TXF",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 4),
            version=None,
        )
        assert event_stats is not None
        assert event_stats.sample_count >= 1

        distribution_stats = service.get_distribution_stats(
            metric_id="day_return",
            code="TXF",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 4),
            version=None,
        )
        assert distribution_stats is not None
        assert distribution_stats.sample_count == 4

        session.commit()
