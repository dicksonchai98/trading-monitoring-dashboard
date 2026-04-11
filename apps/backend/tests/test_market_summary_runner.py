from __future__ import annotations

import fnmatch
from contextlib import suppress
from datetime import datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.market_ingestion.writer import RedisWriter
from app.market_summary.runner import MarketSummaryRunner
from app.models.market_summary_1m import MarketSummary1mModel
from app.services.metrics import Metrics
from app.stream_processing.runner import build_state_key, trade_date_for


class FakeRedis:
    def __init__(self) -> None:
        self.streams: dict[str, list[tuple[str, dict[str, str]]]] = {}
        self.hashes: dict[str, dict[str, str]] = {}
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

    def set(self, key, value):
        self.strings[key] = value

    def zadd(self, key, mapping):
        items = self.zsets.setdefault(key, [])
        for member, score in mapping.items():
            items.append((int(score), member))

    def expire(self, key, ttl):
        self.expirations[key] = ttl

    def hgetall(self, key):
        return self.hashes.get(key, {})


def _market_fields(
    event_ts: str,
    code: str = "TSE001",
    index_value: float = 21000,
    turnover: float = 1000,
):
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
        session_factory=SessionLocal,
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
    )
    runner.ensure_consumer_group()
    return runner


def test_market_summary_consumes_and_writes_redis_state() -> None:
    redis = FakeRedis()
    runner = _build_runner(redis)
    stream_key = "dev:stream:market:TSE001"
    redis.xadd(stream_key, _market_fields("2026-04-06T10:30:01+08:00"))

    assert runner.consume_once() == 1

    trade_date = datetime.fromisoformat("2026-04-05").date()
    latest_key = build_state_key("dev", "TSE001", trade_date, "market_summary:latest")
    series_key = build_state_key("dev", "TSE001", trade_date, "market_summary:zset")
    assert latest_key in redis.strings
    assert series_key in redis.zsets


def test_market_summary_accepts_slash_datetime_event_ts() -> None:
    redis = FakeRedis()
    runner = _build_runner(redis)
    stream_key = "dev:stream:market:TSE001"
    redis.xadd(stream_key, _market_fields("2026/04/06 10:30:01.000000"))

    assert runner.consume_once() == 1
    assert any(key.endswith("market_summary:latest") for key in redis.strings)


def test_market_summary_rollover_persists_minute_snapshot() -> None:
    redis = FakeRedis()
    runner = _build_runner(redis)
    stream_key = "dev:stream:market:TSE001"
    redis.xadd(stream_key, _market_fields("2026-04-06T10:30:01+08:00", turnover=1000))
    redis.xadd(stream_key, _market_fields("2026-04-06T10:31:01+08:00", turnover=1200))

    assert runner.consume_once() == 2
    runner.flush_db_sinks_once()

    with SessionLocal() as session:
        rows = session.query(MarketSummary1mModel).all()
        assert len(rows) >= 1
        assert rows[0].market_code == "TSE001"


def test_market_summary_computes_spread_when_futures_latest_available() -> None:
    redis = FakeRedis()
    runner = _build_runner(redis)
    trade_date = datetime.fromisoformat("2026-04-05").date()
    futures_key = build_state_key("dev", runner._futures_code, trade_date, "k:current")
    redis.hashes[futures_key] = {
        "close": "20535.5",
        "event_ts": "2026-04-06T10:30:00+08:00",
    }
    stream_key = "dev:stream:market:TSE001"
    redis.xadd(stream_key, _market_fields("2026-04-06T10:30:01+08:00", index_value=20500.12))

    assert runner.consume_once() == 1

    latest_key = build_state_key("dev", "TSE001", trade_date, "market_summary:latest")
    payload = redis.strings[latest_key]
    assert '"spread_status": "ok"' in payload
    assert '"futures_price": 20535.5' in payload


def test_market_summary_db_sink_dead_letter_on_retry_exhausted() -> None:
    redis = FakeRedis()
    runner = MarketSummaryRunner(
        redis_client=redis,
        session_factory=SessionLocal,
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
        db_sink_max_retries=1,
    )
    runner.ensure_consumer_group()
    stream_key = "dev:stream:market:TSE001"
    redis.xadd(stream_key, _market_fields("2026-04-06T10:30:01+08:00", turnover=1000))
    redis.xadd(stream_key, _market_fields("2026-04-06T10:31:01+08:00", turnover=1200))
    assert runner.consume_once() == 2

    def _always_fail(_rows):  # type: ignore[no-untyped-def]
        raise RuntimeError("db down")

    runner._persist_batch = _always_fail  # type: ignore[method-assign]
    with suppress(RuntimeError):
        runner._flush_db_sink_once()
    assert runner._flush_db_sink_once() == 0
    assert "dev:stream:dead-letter:market-summary" in redis.streams


def test_market_summary_duplicate_conflict_is_tolerated() -> None:
    redis = FakeRedis()
    runner = _build_runner(redis)
    minute_ts = datetime.fromisoformat("2026-04-06T10:30:00+08:00")
    snapshot = runner._build_snapshot(
        code="TSE001",
        event_ts=minute_ts,
        index_value=21000.0,
        cumulative_turnover=1000.0,
    )
    runner._persist_batch([snapshot, snapshot])
    with SessionLocal() as session:
        rows = (
            session.query(MarketSummary1mModel)
            .filter(MarketSummary1mModel.market_code == "TSE001")
            .all()
        )
        assert len(rows) == 1


def test_market_summary_computes_estimated_comparison_from_previous_trade_date() -> None:
    redis = FakeRedis()
    runner = _build_runner(redis)
    event_ts = datetime.fromisoformat("2026-04-08T10:30:00+08:00")
    current_trade_date = trade_date_for(event_ts)
    previous_trade_date = current_trade_date - timedelta(days=1)

    with SessionLocal() as session:
        session.add(
            MarketSummary1mModel(
                market_code="TSE001",
                trade_date=previous_trade_date,
                minute_ts=datetime.fromisoformat("2026-04-07T10:30:00+08:00"),
                index_value=20000.0,
                cumulative_turnover=800.0,
                completion_ratio=0.5,
                estimated_turnover=1600.0,
                yesterday_estimated_turnover=None,
                estimated_turnover_diff=None,
                estimated_turnover_ratio=None,
                futures_code="MTX",
                futures_price=20001.0,
                spread=1.0,
                spread_day_high=2.0,
                spread_day_low=-1.0,
                spread_strength=0.6,
                spread_status="ok",
                payload="{}",
            )
        )
        session.commit()

    snapshot = runner._build_snapshot(
        code="TSE001",
        event_ts=event_ts,
        index_value=21000.0,
        cumulative_turnover=1000.0,
    )
    assert snapshot.yesterday_estimated_turnover == 1600.0
    assert snapshot.estimated_turnover is not None
    assert snapshot.estimated_turnover_diff is not None
    assert snapshot.estimated_turnover_ratio is not None
    assert snapshot.estimated_turnover_diff == snapshot.estimated_turnover - 1600.0


def test_market_summary_writes_futures_code_alias_keys() -> None:
    redis = FakeRedis()
    runner = MarketSummaryRunner(
        redis_client=redis,
        session_factory=SessionLocal,
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
        futures_code="TXFD6",
    )
    runner.ensure_consumer_group()
    stream_key = "dev:stream:market:TSE001"
    redis.xadd(stream_key, _market_fields("2026-04-06T10:30:01+08:00"))

    assert runner.consume_once() == 1

    trade_date = datetime.fromisoformat("2026-04-05").date()
    source_key = build_state_key("dev", "TSE001", trade_date, "market_summary:latest")
    alias_key = build_state_key("dev", "TXFD6", trade_date, "market_summary:latest")
    assert source_key in redis.strings
    assert alias_key in redis.strings
