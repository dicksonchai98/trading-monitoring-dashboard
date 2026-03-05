"""Redis stream writer with retry and MAXLEN approximate trimming."""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any

from app.market_ingestion.contracts import MetricsProtocol, QueueItem


class RedisWriter:
    def __init__(
        self,
        redis_client: Any,
        metrics: MetricsProtocol,
        maxlen: int,
        retry_attempts: int = 3,
        retry_backoff_ms: int = 50,
    ) -> None:
        self._redis = redis_client
        self._metrics = metrics
        self._maxlen = maxlen
        self._retry_attempts = retry_attempts
        self._retry_backoff_ms = retry_backoff_ms

    def write(self, stream_key: str, fields: dict[str, str]) -> str:
        start = time.perf_counter()
        redis_id = self._redis.xadd(
            stream_key,
            fields,
            maxlen=self._maxlen,
            approximate=True,
        )
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        self._metrics.inc("events_written_redis_total")
        self._metrics.set_gauge("redis_write_latency_ms", elapsed_ms)
        return str(redis_id)

    async def write_with_retry(self, stream_key: str, fields: dict[str, str]) -> bool:
        last_error: Exception | None = None
        for attempt in range(1, self._retry_attempts + 1):
            try:
                self.write(stream_key, fields)
                return True
            except Exception as err:  # pragma: no cover - exercised via tests
                last_error = err
                if attempt == self._retry_attempts:
                    break
                await asyncio.sleep((self._retry_backoff_ms * attempt) / 1000)
        if last_error is not None:
            self._metrics.inc("redis_write_failure_total")
        return False

    @staticmethod
    def to_redis_fields(event: dict[str, Any]) -> dict[str, str]:
        return {
            k: (json.dumps(v, ensure_ascii=True) if isinstance(v, (dict, list)) else str(v))
            for k, v in event.items()
        }

    def update_ingest_lag(self, event_ts: str) -> None:
        try:
            parsed = datetime.fromisoformat(event_ts.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            lag_ms = int((datetime.now(tz=timezone.utc) - parsed).total_seconds() * 1000)
            self._metrics.set_gauge("ingest_lag_ms", max(lag_ms, 0))
        except ValueError:
            return

    async def drain_once(self, queue_item: QueueItem) -> bool:
        event_dict = {
            "source": queue_item.event.source,
            "code": queue_item.event.code,
            "quote_type": queue_item.event.quote_type,
            "event_ts": queue_item.event.event_ts,
            "recv_ts": queue_item.event.recv_ts,
            "payload": queue_item.event.payload,
        }
        self.update_ingest_lag(queue_item.event.event_ts)
        return await self.write_with_retry(queue_item.stream_key, self.to_redis_fields(event_dict))
