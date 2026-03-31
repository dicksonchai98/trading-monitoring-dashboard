from __future__ import annotations

import fnmatch

from app.latest_state.runner import LatestStateRunner
from app.services.metrics import Metrics


class FakeRedis:
    def __init__(self, fail_set: bool = False) -> None:
        self.streams: dict[str, list[tuple[str, dict[str, str]]]] = {}
        self.strings: dict[str, str] = {}
        self.expirations: dict[str, int] = {}
        self.acks: list[tuple[str, str, str]] = []
        self._stream_id = 0
        self._fail_set = fail_set

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

    def set(self, key, value):
        if self._fail_set:
            raise RuntimeError("set failed")
        self.strings[key] = value

    def expire(self, key, ttl):
        self.expirations[key] = ttl

    def pipeline(self, transaction=False):
        _ = transaction
        return _FakePipeline(self)


class _FakePipeline:
    def __init__(self, redis: FakeRedis) -> None:
        self._redis = redis
        self._ops: list[tuple[str, str, object]] = []

    def set(self, key, value):
        self._ops.append(("set", key, value))
        return self

    def expire(self, key, ttl):
        self._ops.append(("expire", key, ttl))
        return self

    def execute(self):
        for op, key, value in self._ops:
            if op == "set":
                self._redis.set(key, value)
            elif op == "expire":
                self._redis.expire(key, int(value))


def _spot_fields(symbol: str, last_price: float, ingest_seq: int) -> dict[str, str]:
    return {
        "source": "shioaji",
        "symbol": symbol,
        "event_ts": "2026-03-21T09:01:02+00:00",
        "last_price": str(last_price),
        "ingest_seq": str(ingest_seq),
        "payload": "{}",
        "asset_type": "spot",
    }


def test_latest_state_runner_updates_and_flushes_state() -> None:
    redis = FakeRedis()
    metrics = Metrics()
    runner = LatestStateRunner(
        redis_client=redis,
        metrics=metrics,
        env="dev",
        group="latest-state:spot",
        consumer="latest-state-1",
        read_count=100,
        block_ms=0,
        claim_idle_ms=1000,
        claim_count=100,
        flush_interval_ms=1,
    )
    stream_key = "dev:stream:spot:2330"
    redis.xadd(stream_key, _spot_fields("2330", 612.0, 1))

    assert runner.consume_once() == 1
    latest_key = "dev:state:spot:2330:latest"
    assert latest_key in redis.strings
    assert metrics.counters["latest_state_events_processed_total"] == 1


def test_latest_state_runner_ignores_replayed_ingest_seq() -> None:
    redis = FakeRedis()
    metrics = Metrics()
    runner = LatestStateRunner(
        redis_client=redis,
        metrics=metrics,
        env="dev",
        group="latest-state:spot",
        consumer="latest-state-1",
        read_count=100,
        block_ms=0,
        claim_idle_ms=1000,
        claim_count=100,
        flush_interval_ms=1,
    )
    stream_key = "dev:stream:spot:2330"
    redis.xadd(stream_key, _spot_fields("2330", 612.0, 2))
    redis.xadd(stream_key, _spot_fields("2330", 611.0, 1))

    assert runner.consume_once() == 2
    assert runner._latest_state["2330"]["last_price"] == 612.0


def test_latest_state_runner_does_not_ack_when_flush_fails() -> None:
    redis = FakeRedis(fail_set=True)
    metrics = Metrics()
    runner = LatestStateRunner(
        redis_client=redis,
        metrics=metrics,
        env="dev",
        group="latest-state:spot",
        consumer="latest-state-1",
        read_count=100,
        block_ms=0,
        claim_idle_ms=1000,
        claim_count=100,
        flush_interval_ms=1,
    )
    stream_key = "dev:stream:spot:2330"
    redis.xadd(stream_key, _spot_fields("2330", 612.0, 1))

    assert runner.consume_once() == 0
    assert redis.acks == []
    assert metrics.counters["latest_state_flush_errors_total"] >= 1
