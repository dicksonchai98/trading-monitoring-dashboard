"""Metrics helpers for batch runtime."""

from __future__ import annotations


class BatchMetrics:
    def __init__(self) -> None:
        self.counters: dict[str, int | float] = {
            "batch_job_duration_seconds": 0,
            "batch_job_failures_total": 0,
            "batch_rows_processed_total": 0,
            "batch_retry_count_total": 0,
        }

    def inc(self, key: str, value: int | float = 1) -> None:
        self.counters[key] = self.counters.get(key, 0) + value

    def set_gauge(self, key: str, value: int | float) -> None:
        self.counters[key] = value
