from __future__ import annotations

import fnmatch

from app.market_ingestion.writer import RedisWriter
from app.services.metrics import Metrics
from app.stream_processing.runner import StreamProcessingRunner


class FakeRedis:
    def __init__(self) -> None:
        self.streams: dict[str, list[tuple[str, dict[str, str]]]] = {}
        self.acks: list[tuple[str, str, str]] = []
        self._stream_id = 0

    def xadd(self, key, fields, maxlen=None, approximate=None):
        _ = (maxlen, approximate)
        self._stream_id += 1
        entry_id = f"{self._stream_id}-0"
        self.streams.setdefault(key, []).append((entry_id, fields))
        return entry_id

    def xgroup_create(self, key, group, stream_id="0-0", mkstream=False, **kwargs):
        stream_id = kwargs.get("id", stream_id)
        _ = (group, stream_id, mkstream)
        self.streams.setdefault(key, [])

    def xreadgroup(self, groupname, consumername, streams, count=1, block=0):
        _ = (groupname, consumername, block)
        result = []
        for stream_key in streams:
            items = self.streams.get(stream_key, [])
            if not items:
                continue
            batch = []
            for _ in range(min(count or len(items), len(items))):
                batch.append(items.pop(0))
            if batch:
                result.append((stream_key, batch))
        return result

    def xautoclaim(self, key, groupname, consumername, min_idle_time, start_id="0-0", count=1):
        _ = (key, groupname, consumername, min_idle_time, start_id, count)
        return "0-0", [], []

    def xack(self, key, group, entry_id):
        self.acks.append((key, group, entry_id))
        return 1

    def scan_iter(self, pattern):
        for key in self.streams:
            if fnmatch.fnmatch(key, pattern):
                yield key

    def xlen(self, key):
        return len(self.streams.get(key, []))

    def hset(self, key, mapping):
        _ = (key, mapping)

    def zadd(self, key, mapping):
        _ = (key, mapping)

    def set(self, key, value):
        _ = (key, value)

    def expire(self, key, ttl):
        _ = (key, ttl)


def test_stream_processing_consumer_smoke() -> None:
    redis = FakeRedis()
    metrics = Metrics()
    runner = StreamProcessingRunner(
        redis_client=redis,
        session_factory=lambda: None,
        metrics=metrics,
        env="dev",
        code="MTX",
        tick_group="agg:tick",
        bidask_group="agg:bidask",
        tick_consumer="agg-tick-1",
        bidask_consumer="agg-bidask-1",
        read_count=100,
        block_ms=0,
        claim_idle_ms=1000,
        claim_count=100,
        ttl_seconds=60 * 60 * 24,
        series_fields=["bid", "ask", "mid", "spread", "delta_1s"],
    )
    runner.ensure_consumer_groups()

    tick_stream = "dev:stream:tick:MTX"
    for i in range(200):
        fields = RedisWriter.to_redis_fields(
            {
                "source": "shioaji",
                "code": "MTX",
                "quote_type": "tick",
                "event_ts": "2026-03-05T09:00:00+08:00",
                "recv_ts": "2026-03-05T01:00:00+00:00",
                "payload": {"price": 100 + i, "volume": 1},
            }
        )
        redis.xadd(tick_stream, fields)

    processed = runner.consume_tick_once()
    assert processed == 200
    assert len(redis.acks) == 200
