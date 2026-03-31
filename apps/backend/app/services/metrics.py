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
            "ingestion_spot_events_total": 0,
            "ingestion_spot_events_dropped_total": 0,
            "ingestion_spot_queue_depth": 0,
            "ingestion_spot_publish_errors_total": 0,
            "ingestion_spot_lag_ms": 0,
            "ingestion_spot_events_written_redis_total": 0,
            "ingestion_spot_redis_write_latency_ms": 0,
            "consume_rate": 0,
            "archive_rate": 0,
            "sampling_rate": 0,
            "stream_lag": 0,
            "write_errors": 0,
            "write_latency": 0,
            "late_tick_drops": 0,
            "latest_state_events_processed_total": 0,
            "latest_state_process_errors_total": 0,
            "latest_state_flush_total": 0,
            "latest_state_flush_errors_total": 0,
            "latest_state_stream_lag_ms": 0,
            "latest_state_dirty_symbols": 0,
            "serving_rest_requests_total": 0,
            "serving_rest_latency_ms": 0,
            "serving_sse_connections_active": 0,
            "serving_sse_push_total": 0,
            "serving_redis_errors_total": 0,
            "serving_db_errors_total": 0,
            "serving_rate_limit_denied": 0,
            "serving_auth_denied": 0,
        }

    def inc(self, key: str) -> None:
        self.counters[key] = self.counters.get(key, 0) + 1

    def set_gauge(self, key: str, value: int | float) -> None:
        self.counters[key] = value
