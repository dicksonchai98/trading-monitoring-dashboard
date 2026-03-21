"""In-memory queue pipeline from callbacks to writer."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from app.market_ingestion.contracts import IngestionEvent, MetricsProtocol, QueueItem


class IngestionPipeline:
    def __init__(
        self,
        queue_maxsize: int,
        metrics: MetricsProtocol,
        metric_prefix: str = "",
    ) -> None:
        self.queue: asyncio.Queue[QueueItem] = asyncio.Queue(maxsize=queue_maxsize)
        self._metrics = metrics
        self._metric_prefix = metric_prefix

    def _metric(self, name: str) -> str:
        return f"{self._metric_prefix}{name}" if self._metric_prefix else name

    def build_event(
        self,
        code: str,
        quote_type: str,
        payload: dict[str, Any],
        event_ts: str,
        asset_type: str = "futures",
        ingest_seq: int | None = None,
    ) -> IngestionEvent:
        recv_ts = datetime.now(tz=timezone.utc).isoformat()
        return IngestionEvent(
            source="shioaji",
            code=code,
            asset_type=asset_type,
            quote_type=quote_type,
            event_ts=event_ts,
            recv_ts=recv_ts,
            ingest_seq=ingest_seq,
            payload=payload,
        )

    def enqueue(self, stream_key: str, event: IngestionEvent) -> bool:
        self._metrics.inc(self._metric("events_received_total"))
        try:
            self.queue.put_nowait(QueueItem(stream_key=stream_key, event=event))
            self._metrics.set_gauge(self._metric("queue_depth"), self.queue.qsize())
            return True
        except asyncio.QueueFull:
            self._metrics.inc(self._metric("events_dropped_total"))
            self._metrics.set_gauge(self._metric("queue_depth"), self.queue.qsize())
            return False
