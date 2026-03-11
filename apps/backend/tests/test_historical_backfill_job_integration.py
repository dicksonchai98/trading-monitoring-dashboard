from __future__ import annotations

from datetime import date
from typing import Any

import pytest
from app.db.session import SessionLocal
from app.models.kbar_1m import Kbar1mModel
from app.modules.batch_shared.jobs.interfaces import JobContext
from app.modules.historical_backfill.fetcher import HistoricalFetcher
from app.modules.historical_backfill.job import HistoricalBackfillJobImplementation
from app.modules.historical_backfill.writer import upsert_kbars as real_upsert_kbars
from sqlalchemy import select


class _FakeFetcher(HistoricalFetcher):
    def __init__(self) -> None:
        super().__init__(client_factory=lambda: None)  # type: ignore[arg-type]
        self.calls: list[tuple[date, date]] = []

    def fetch_bars(self, *, code: str, start_date: date, end_date: date) -> list[dict[str, Any]]:
        _ = code
        self.calls.append((start_date, end_date))
        return [
            {
                "ts": f"{start_date.isoformat()}T01:30:00+00:00",
                "open": 100,
                "high": 101,
                "low": 99,
                "close": 100.5,
                "volume": 10,
            }
        ]


def test_chunk_transaction_rollback_isolated_on_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    fetcher = _FakeFetcher()
    impl = HistoricalBackfillJobImplementation(
        session_factory=SessionLocal,
        fetcher=fetcher,
        retry_max_attempts=1,
        retry_backoff_seconds=0,
    )
    context = JobContext(job_id=1, job_type="historical_backfill")
    context.update_progress = lambda **_: None  # type: ignore[assignment]

    attempts: dict[str, int] = {}

    def flaky_upsert(session, rows, overwrite_mode="closed_only"):  # type: ignore[no-untyped-def]
        cursor = rows[0].trade_date.isoformat()
        attempts[cursor] = attempts.get(cursor, 0) + 1
        if cursor == "2026-03-02":
            session.add(
                Kbar1mModel(
                    code=rows[0].code,
                    trade_date=rows[0].trade_date,
                    minute_ts=rows[0].minute_ts,
                    open=rows[0].open,
                    high=rows[0].high,
                    low=rows[0].low,
                    close=rows[0].close,
                    volume=rows[0].volume,
                )
            )
            raise TimeoutError("provider timeout")
        return real_upsert_kbars(session, rows, overwrite_mode)

    monkeypatch.setattr("app.modules.historical_backfill.job.upsert_kbars", flaky_upsert)

    with pytest.raises(TimeoutError):
        impl.execute(
            params={
                "code": "TXF",
                "start_date": "2026-03-01",
                "end_date": "2026-03-02",
                "overwrite_mode": "force",
            },
            context=context,
        )

    with SessionLocal() as session:
        rows = list(session.execute(select(Kbar1mModel).order_by(Kbar1mModel.trade_date)).scalars())
    assert len(rows) == 1
    assert rows[0].trade_date.isoformat() == "2026-03-01"


def test_resume_from_checkpoint_cursor_skips_committed_chunks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fetcher = _FakeFetcher()
    impl = HistoricalBackfillJobImplementation(
        session_factory=SessionLocal,
        fetcher=fetcher,
        retry_max_attempts=2,
        retry_backoff_seconds=0,
    )
    context = JobContext(job_id=2, job_type="historical_backfill")
    context.update_progress = lambda **_: None  # type: ignore[assignment]

    retry_events: list[tuple[str, int]] = []
    context.on_chunk_retry = (  # type: ignore[attr-defined]
        lambda *, chunk_cursor, attempt: retry_events.append((chunk_cursor, attempt))
    )

    result = impl.execute(
        params={
            "code": "TXF",
            "start_date": "2026-03-01",
            "end_date": "2026-03-03",
            "overwrite_mode": "force",
            "checkpoint_cursor": "2026-03-01",
        },
        context=context,
    )

    assert result.rows_processed == 2
    assert [call[0].isoformat() for call in fetcher.calls] == ["2026-03-02", "2026-03-03"]
    assert retry_events == []
