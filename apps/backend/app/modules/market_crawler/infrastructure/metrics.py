"""Crawler metrics helpers."""

from __future__ import annotations


class CrawlerMetrics:
    def __init__(self) -> None:
        self.counters: dict[str, int | float] = {
            "crawler_job_duration_seconds": 0,
            "crawler_job_failures_total": 0,
            "crawler_rows_fetched_total": 0,
            "crawler_rows_normalized_total": 0,
            "crawler_rows_persisted_total": 0,
            "crawler_retry_count_total": 0,
            "crawler_stage_duration_seconds": 0,
        }

    def inc(self, key: str, value: int | float = 1) -> None:
        self.counters[key] = self.counters.get(key, 0) + value

    def set_gauge(self, key: str, value: int | float) -> None:
        self.counters[key] = value
