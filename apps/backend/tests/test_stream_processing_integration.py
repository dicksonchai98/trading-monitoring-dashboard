from __future__ import annotations

import fnmatch
from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.market_ingestion.writer import RedisWriter
from app.models.kbar_1m import Kbar1mModel
from app.services.metrics import Metrics
from app.stream_processing.runner import StreamProcessingRunner, build_state_key


class FakeRedis:
    def __init__(self) -> None:
        self.streams: dict[str, list[tuple[str, dict[str, str]]]] = {}
        self.hashes: dict[str, dict[str, str]] = {}
        self.zsets: dict[str, list[tuple[int, str]]] = {}
        self.strings: dict[str, str] = {}
        self.expirations: dict[str, int] = {}
        self.acks: list[tuple[str, str, str]] = []
        self._stream_id = 0

    def xadd(self, key, fields, maxlen=None, approximate=None):
        _ = (maxlen, approximate)
        self._stream_id += 1
        entry_id = f"{self._stream_id}-0"
        self.streams.setdefault(key, []).append((entry_id, fields))
        return entry_id

    def xgroup_create(self, key, group, stream_id="0-0", mkstream=False):
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
        self.hashes[key] = dict(mapping)

    def zadd(self, key, mapping):
        items = self.zsets.setdefault(key, [])
        for member, score in mapping.items():
            items.append((int(score), member))

    def set(self, key, value):
        self.strings[key] = value

    def expire(self, key, ttl):
        self.expirations[key] = ttl


def build_event_fields(
    quote_type: str, event_ts: str, payload: dict[str, object], code: str = "MTX"
) -> dict[str, str]:
    event = {
        "source": "shioaji",
        "code": code,
        "quote_type": quote_type,
        "event_ts": event_ts,
        "recv_ts": datetime.now(tz=timezone.utc).isoformat(),
        "payload": payload,
    }
    return RedisWriter.to_redis_fields(event)


def build_runner(redis: FakeRedis) -> StreamProcessingRunner:
    metrics = Metrics()
    runner = StreamProcessingRunner(
        redis_client=redis,
        session_factory=SessionLocal,
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
    return runner


def test_stream_processing_writes_redis_state() -> None:
    redis = FakeRedis()
    runner = build_runner(redis)

    tick_stream = "dev:stream:tick:MTX"
    redis.xadd(
        tick_stream,
        build_event_fields(
            "tick", "2026-03-05T09:30:10+08:00", {"price": 100, "volume": 1}, code="TXFC6"
        ),
    )
    redis.xadd(
        tick_stream,
        build_event_fields(
            "tick", "2026-03-05T09:31:01+08:00", {"price": 101, "volume": 2}, code="TXFC6"
        ),
    )

    bidask_stream = "dev:stream:bidask:MTX"
    redis.xadd(
        bidask_stream,
        build_event_fields(
            "bidask", "2026-03-05T09:31:02+08:00", {"bid": 100, "ask": 102}, code="TXFC6"
        ),
    )

    assert runner.consume_tick_once() == 2
    assert runner.consume_bidask_once() == 1

    trade_date = "2026-03-04"
    current_key = build_state_key(
        "dev", "TXFC6", datetime.fromisoformat(trade_date).date(), "k:current"
    )
    zset_key = build_state_key("dev", "TXFC6", datetime.fromisoformat(trade_date).date(), "k:zset")
    metrics_key = build_state_key(
        "dev", "TXFC6", datetime.fromisoformat(trade_date).date(), "metrics:latest"
    )
    metric_zset_key = build_state_key(
        "dev", "TXFC6", datetime.fromisoformat(trade_date).date(), "metrics:zset"
    )

    assert current_key in redis.hashes
    assert zset_key in redis.zsets
    assert len(redis.zsets[zset_key]) == 1
    assert metrics_key in redis.strings
    assert metric_zset_key in redis.zsets


def test_stream_processing_persists_kbars_to_postgres() -> None:
    redis = FakeRedis()
    runner = build_runner(redis)

    tick_stream = "dev:stream:tick:MTX"
    redis.xadd(
        tick_stream,
        build_event_fields(
            "tick", "2026-03-05T09:30:10+08:00", {"price": 100, "volume": 1}, code="TXFC6"
        ),
    )
    redis.xadd(
        tick_stream,
        build_event_fields(
            "tick", "2026-03-05T09:31:05+08:00", {"price": 101, "volume": 2}, code="TXFC6"
        ),
    )

    assert runner.consume_tick_once() == 2

    with SessionLocal() as session:
        rows = session.query(Kbar1mModel).all()
        assert len(rows) == 1
        assert rows[0].code == "TXFC6"
