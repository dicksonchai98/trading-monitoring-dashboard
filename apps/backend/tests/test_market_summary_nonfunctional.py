from __future__ import annotations

import fnmatch
from contextlib import suppress
from datetime import datetime, timezone

from app.market_ingestion.writer import RedisWriter
from app.market_summary.runner import MarketSummaryRunner
from app.services.metrics import Metrics


class FakeRedis:
    def __init__(self) -> None:
        self.streams: dict[str, list[tuple[str, dict[str, str]]]] = {}
        self.strings: dict[str, str] = {}
        self.zsets: dict[str, list[tuple[int, str]]] = {}
        self.expirations: dict[str, int] = {}
        self.acks: list[tuple[str, str, str]] = []
        self._stream_id = 0
        self.fail_xreadgroup_times = 0

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
        if self.fail_xreadgroup_times > 0:
            self.fail_xreadgroup_times -= 1
            raise ConnectionError("redis unavailable")
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

    def set(self, key, value):
        self.strings[key] = value

    def zadd(self, key, mapping):
        items = self.zsets.setdefault(key, [])
        for member, score in mapping.items():
            items.append((int(score), member))

    def expire(self, key, ttl):
        self.expirations[key] = ttl


def _market_fields(
    event_ts: str,
    code: str = "TSE001",
    index_value: float = 21000,
    turnover: float = 1000,
) -> dict[str, str]:
    return RedisWriter.to_redis_fields(
        {
            "source": "market_feed",
            "code": code,
            "quote_type": "market",
            "event_ts": event_ts,
            "recv_ts": datetime.now(tz=timezone.utc).isoformat(),
            "payload": {
                "index_value": index_value,
                "cumulative_turnover": turnover,
            },
        }
    )


def _build_runner(redis: FakeRedis) -> MarketSummaryRunner:
    runner = MarketSummaryRunner(
        redis_client=redis,
        session_factory=lambda: None,
        metrics=Metrics(),
        env="dev",
        code="TSE001",
        group="agg:market",
        consumer="agg-market-1",
        read_count=100,
        block_ms=0,
        claim_idle_ms=1000,
        claim_count=100,
        ttl_seconds=3600,
        db_sink_max_retries=2,
    )
    runner.ensure_consumer_group()
    return runner


def test_market_summary_recovers_after_transient_redis_read_failure() -> None:
    redis = FakeRedis()
    runner = _build_runner(redis)
    stream_key = "dev:stream:market:TSE001"
    redis.xadd(stream_key, _market_fields("2026-04-06T10:30:01+08:00"))
    redis.fail_xreadgroup_times = 1

    assert runner.consume_once() == 0
    assert redis.acks == []

    assert runner.consume_once() == 1
    assert len(redis.acks) == 1


def test_market_summary_db_sink_retries_then_succeeds_without_dead_letter() -> None:
    redis = FakeRedis()
    runner = _build_runner(redis)
    stream_key = "dev:stream:market:TSE001"
    redis.xadd(stream_key, _market_fields("2026-04-06T10:30:01+08:00", turnover=1000))
    redis.xadd(stream_key, _market_fields("2026-04-06T10:31:01+08:00", turnover=1200))
    assert runner.consume_once() == 2

    attempts = {"count": 0}

    def _flaky_persist(_rows):  # type: ignore[no-untyped-def]
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise RuntimeError("temporary db error")

    runner._persist_batch = _flaky_persist  # type: ignore[method-assign]

    for _ in range(2):
        with suppress(RuntimeError):
            runner._flush_db_sink_once()
    assert runner._flush_db_sink_once() == 1
    assert attempts["count"] == 3
    assert "dev:stream:dead-letter:market-summary" not in redis.streams


def test_market_summary_db_sink_exhaustion_publishes_dead_letter() -> None:
    redis = FakeRedis()
    runner = _build_runner(redis)
    stream_key = "dev:stream:market:TSE001"
    redis.xadd(stream_key, _market_fields("2026-04-06T10:30:01+08:00", turnover=1000))
    redis.xadd(stream_key, _market_fields("2026-04-06T10:31:01+08:00", turnover=1200))
    assert runner.consume_once() == 2

    def _always_fail(_rows):  # type: ignore[no-untyped-def]
        raise RuntimeError("db permanently down")

    runner._persist_batch = _always_fail  # type: ignore[method-assign]

    for _ in range(2):
        with suppress(RuntimeError):
            runner._flush_db_sink_once()
    assert runner._flush_db_sink_once() == 0
    assert "dev:stream:dead-letter:market-summary" in redis.streams
