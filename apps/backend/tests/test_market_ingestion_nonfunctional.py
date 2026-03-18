from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from app.market_ingestion.pipeline import IngestionPipeline
from app.market_ingestion.writer import RedisWriter
from app.services.metrics import Metrics


class CountingRedis:
    def __init__(self) -> None:
        self.count = 0

    def xadd(self, _key, _fields, maxlen, approximate):
        _ = (maxlen, approximate)
        self.count += 1
        return f"{self.count}-0"


def test_sustained_ingest_path_processes_burst_without_unbounded_growth() -> None:
    metrics = Metrics()
    pipeline = IngestionPipeline(queue_maxsize=256, metrics=metrics)
    redis = CountingRedis()
    writer = RedisWriter(redis_client=redis, metrics=metrics, maxlen=100000)

    for idx in range(500):
        event = pipeline.build_event(
            code="MTX",
            quote_type="tick",
            payload={"idx": idx},
            event_ts=datetime.now(tz=timezone.utc).isoformat(),
        )
        pipeline.enqueue("dev:stream:tick:MTX", event)

    processed = 0
    while not pipeline.queue.empty():
        processed += 1
        item = pipeline.queue.get_nowait()
        ok = asyncio.run(writer.drain_once(item))
        assert ok is True
        pipeline.queue.task_done()

    assert processed == redis.count
    assert metrics.counters["queue_depth"] >= 0
