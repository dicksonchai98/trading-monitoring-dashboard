"""Simple in-memory metrics counters."""

from __future__ import annotations


class Metrics:
    def __init__(self) -> None:
        self.counters: dict[str, int | float] = {
            "login_success": 0,
            "login_failure": 0,
            "refresh_success": 0,
            "refresh_failure": 0,
            "refresh_denylist_hit": 0,
            "authorization_denied": 0,
            "sse_auth_failure": 0,
            "events_received_total": 0,
            "events_written_redis_total": 0,
            "redis_write_latency_ms": 0,
            "redis_write_failure_total": 0,
            "ws_reconnect_count": 0,
            "queue_depth": 0,
            "ingest_lag_ms": 0,
            "events_dropped_total": 0,
            "consume_rate": 0,
            "archive_rate": 0,
            "sampling_rate": 0,
            "stream_lag": 0,
            "write_errors": 0,
            "write_latency": 0,
            "late_tick_drops": 0,
        }

    def inc(self, key: str) -> None:
        self.counters[key] = self.counters.get(key, 0) + 1

    def set_gauge(self, key: str, value: int | float) -> None:
        self.counters[key] = value
