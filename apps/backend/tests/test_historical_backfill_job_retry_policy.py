from __future__ import annotations

import pytest

from app.modules.historical_backfill.job import HistoricalBackfillJobImplementation


class _Context:
    job_id = 1
    job_type = "historical_backfill"

    def update_progress(self, **_kwargs) -> None:
        return


def test_backfill_job_raises_after_single_retryable_error() -> None:
    calls: list[int] = []

    class _Fetcher:
        def fetch_bars(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            _ = (args, kwargs)
            calls.append(1)
            raise TimeoutError("transient")

    job = HistoricalBackfillJobImplementation(
        session_factory=lambda: None,  # not used before fetcher raises
        fetcher=_Fetcher(),
        retry_max_attempts=3,
        retry_backoff_seconds=0,
    )

    with pytest.raises(TimeoutError):
        job.execute(
            params={
                "code": "TXF",
                "start_date": "2026-03-01",
                "end_date": "2026-03-01",
                "overwrite_mode": "closed_only",
            },
            context=_Context(),
        )

    assert len(calls) == 1
