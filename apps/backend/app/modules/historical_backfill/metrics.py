"""Metrics helpers for historical backfill runtime."""

from __future__ import annotations


class BackfillMetrics:
    def __init__(self) -> None:
        self.counters: dict[str, int | float] = {
            "backfill_job_duration_seconds": 0,
            "backfill_job_failure_count": 0,
            "backfill_rows_processed_total": 0,
            "backfill_chunk_retry_total": 0,
            "backfill_active_jobs": 0,
        }

    def inc(self, key: str, value: int | float = 1) -> None:
        self.counters[key] = self.counters.get(key, 0) + value

    def set_gauge(self, key: str, value: int | float) -> None:
        self.counters[key] = value
