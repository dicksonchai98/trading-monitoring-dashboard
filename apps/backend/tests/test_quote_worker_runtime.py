from __future__ import annotations

import fnmatch
import json
from contextlib import suppress
from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.models.quote_feature_1m import QuoteFeature1mModel
from app.quote_processing.runner import QuoteWorkerRunner
from app.services.metrics import Metrics
from app.stream_processing.runner import build_state_key, trade_date_for


class FakeRedis:
    def __init__(self) -> None:
        self.streams: dict[str, list[tuple[str, dict[str, str]]]] = {}
        self.strings: dict[str, str] = {}
        self.zsets: dict[str, list[tuple[int, str]]] = {}
        self.expirations: dict[str, int] = {}
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

    def xautoclaim(self, key, group, consumer, min_idle_time, start_id="0-0", count=1):
        _ = (key, group, consumer, min_idle_time, start_id, count)
        return "0-0", [], []

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

    def xack(self, key, group, entry_id):
        self.acks.append((key, group, entry_id))
        return 1

    def set(self, key, value):
        self.strings[key] = value

    def zadd(self, key, mapping):
        rows = self.zsets.setdefault(key, [])
        for member, score in mapping.items():
            rows.append((int(score), member))

    def expire(self, key, ttl):
        self.expirations[key] = ttl

    def scan_iter(self, pattern):
        for key in self.streams:
            if fnmatch.fnmatch(key, pattern):
                yield key

    def xlen(self, key):
        return len(self.streams.get(key, []))


class FailingRedis(FakeRedis):
    def set(self, key, value):  # type: ignore[override]
        _ = (key, value)
        raise RuntimeError("redis down")


def _to_fields(code: str, event_ts: str, payload: dict[str, object]) -> dict[str, str]:
    event = {
        "source": "shioaji",
        "code": code,
        "quote_type": "quote",
        "event_ts": event_ts,
        "recv_ts": datetime.now(tz=timezone.utc).isoformat(),
        "payload": payload,
    }
    return {
        k: json.dumps(v, ensure_ascii=True) if isinstance(v, (dict, list)) else str(v)
        for k, v in event.items()
    }


def _build_runner(redis_client) -> QuoteWorkerRunner:  # type: ignore[no-untyped-def]
    return QuoteWorkerRunner(
        redis_client=redis_client,
        session_factory=SessionLocal,
        metrics=Metrics(),
        env="dev",
        code="MTX",
        group="agg:quote",
        consumer="quote-worker-1",
        stream_maxlen=100000,
        redis_retry_attempts=1,
        redis_retry_backoff_ms=0,
        db_flush_enabled=True,
        block_ms=0,
        db_sink_max_retries=1,
    )


def test_quote_worker_consumes_and_writes_redis_state() -> None:
    redis = FakeRedis()
    runner = _build_runner(redis)
    runner.ensure_consumer_groups()
    stream = "dev:stream:quote:MTX"
    redis.xadd(
        stream,
        _to_fields(
            "TXFC6",
            "2026-04-05T09:30:01+08:00",
            {
                "ask_side_total_cnt": 10,
                "bid_side_total_cnt": 3,
                "tick_type": 1,
                "volume": 2,
            },
        ),
    )
    assert runner.consume_once() == 1
    trade_date = trade_date_for(datetime.fromisoformat("2026-04-05T09:30:01+08:00"))
    latest_key = build_state_key("dev", "TXFC6", trade_date, "quote_features:latest")
    zset_key = build_state_key("dev", "TXFC6", trade_date, "quote_features:zset")
    assert latest_key in redis.strings
    assert zset_key in redis.zsets
    assert len(redis.acks) == 1


def test_quote_worker_does_not_ack_when_redis_write_fails() -> None:
    redis = FailingRedis()
    runner = _build_runner(redis)
    runner.ensure_consumer_groups()
    redis.xadd(
        "dev:stream:quote:MTX",
        _to_fields(
            "TXFC6",
            "2026-04-05T09:30:01+08:00",
            {
                "ask_side_total_cnt": 10,
                "bid_side_total_cnt": 3,
                "tick_type": 1,
                "volume": 2,
            },
        ),
    )
    assert runner.consume_once() == 0
    assert redis.acks == []


def test_quote_worker_flushes_previous_minute_to_db() -> None:
    redis = FakeRedis()
    runner = _build_runner(redis)
    runner.ensure_consumer_groups()
    stream = "dev:stream:quote:MTX"
    redis.xadd(
        stream,
        _to_fields(
            "TXFC6",
            "2026-04-05T09:30:01+08:00",
            {
                "ask_side_total_cnt": 10,
                "bid_side_total_cnt": 3,
                "tick_type": 1,
                "volume": 2,
            },
        ),
    )
    redis.xadd(
        stream,
        _to_fields(
            "TXFC6",
            "2026-04-05T09:31:01+08:00",
            {
                "ask_side_total_cnt": 11,
                "bid_side_total_cnt": 4,
                "tick_type": 2,
                "volume": 1,
            },
        ),
    )
    assert runner.consume_once() == 2
    assert runner.flush_db_sink_once() == 1
    with SessionLocal() as session:
        rows = session.query(QuoteFeature1mModel).all()
        assert len(rows) == 1
        assert rows[0].code == "TXFC6"


def test_quote_worker_dead_letters_after_retry_exhausted() -> None:
    redis = FakeRedis()
    runner = _build_runner(redis)
    runner.ensure_consumer_groups()
    stream = "dev:stream:quote:MTX"
    redis.xadd(
        stream,
        _to_fields(
            "TXFC6",
            "2026-04-05T09:30:01+08:00",
            {
                "ask_side_total_cnt": 10,
                "bid_side_total_cnt": 3,
                "tick_type": 1,
                "volume": 2,
            },
        ),
    )
    redis.xadd(
        stream,
        _to_fields(
            "TXFC6",
            "2026-04-05T09:31:01+08:00",
            {
                "ask_side_total_cnt": 11,
                "bid_side_total_cnt": 4,
                "tick_type": 2,
                "volume": 1,
            },
        ),
    )
    assert runner.consume_once() == 2

    def _always_fail(_rows):  # type: ignore[no-untyped-def]
        raise RuntimeError("db down")

    runner._persist_batch = _always_fail  # type: ignore[method-assign]
    with suppress(RuntimeError):
        runner._flush_db_sink_once()
    assert runner._flush_db_sink_once() == 0
    assert "dev:stream:dead-letter:quote" in redis.streams
