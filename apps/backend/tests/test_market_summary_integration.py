from __future__ import annotations

import asyncio
import fnmatch

from app.db.session import SessionLocal
from app.market_ingestion.runner import MarketIngestionRunner
from app.market_ingestion.shioaji_client import ShioajiClient
from app.market_summary.runner import MarketSummaryRunner
from app.models.market_summary_1m import MarketSummary1mModel
from app.services.metrics import Metrics


class FakeQuoteApi:
    def __init__(self) -> None:
        self._callbacks: dict[str, object] = {}

    def set_on_tick_fop_v1_callback(self, callback) -> None:
        self._callbacks["tick_fop"] = callback

    def set_on_bidask_fop_v1_callback(self, callback) -> None:
        self._callbacks["bidask_fop"] = callback

    def set_on_tick_stk_v1_callback(self, callback) -> None:
        self._callbacks["tick_stk"] = callback

    def set_on_tick_idx_v1_callback(self, callback) -> None:
        self._callbacks["tick_idx"] = callback

    def on_event(self, callback):
        self._callbacks["event"] = callback
        return callback

    def subscribe(self, *_args, **_kwargs) -> None:
        return None


class FakeContracts:
    def __init__(self) -> None:
        self.Futures = {"MTXR1": object(), "MTX": object()}
        self.Indexs = {"TSE001": object()}
        self.Stocks = {}


class FakeAPI:
    def __init__(self) -> None:
        self.quote = FakeQuoteApi()
        self.Contracts = FakeContracts()

    def login(self, **_kwargs):
        return ["account"]

    def fetch_contracts(self, **_kwargs):
        return None

    def logout(self):
        return None


class FakeRedis:
    def __init__(self) -> None:
        self.streams: dict[str, list[tuple[str, dict[str, str]]]] = {}
        self.hashes: dict[str, dict[str, str]] = {}
        self.strings: dict[str, str] = {}
        self.zsets: dict[str, list[tuple[int, str]]] = {}
        self.expirations: dict[str, int] = {}
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

    def xack(self, *_args, **_kwargs):
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


class FakeMarketQuote:
    def __init__(self, ts: str, turnover: float) -> None:
        self.code = "TSE001"
        self.datetime = ts
        self._turnover = turnover

    def to_dict(self, raw: bool = True):  # noqa: ARG002
        return {
            "index_value": 21000.0,
            "cumulative_turnover": self._turnover,
        }


def test_market_summary_end_to_end_ingest_to_worker() -> None:
    redis = FakeRedis()
    metrics = Metrics()
    ingestor = MarketIngestionRunner(
        shioaji_client=ShioajiClient(api=FakeAPI(), api_key="k", secret_key="s", simulation=True),
        redis_client=redis,
        metrics=metrics,
        queue_maxsize=16,
        stream_maxlen=1000,
        retry_attempts=2,
        retry_backoff_ms=1,
    )
    ingestor._market_enabled = True
    ingestor._market_code = "TSE001"

    async def _write_market_events() -> None:
        ingestor._on_market_quote(FakeMarketQuote("2026-04-06T10:30:01+08:00", 1000.0))
        ingestor._on_market_quote(FakeMarketQuote("2026-04-06T10:31:01+08:00", 1200.0))
        while not ingestor._futures_pipeline.queue.empty():
            item = ingestor._futures_pipeline.queue.get_nowait()
            ok = await ingestor._futures_writer.drain_once(item)
            assert ok is True
            ingestor._futures_pipeline.queue.task_done()

    asyncio.run(_write_market_events())

    worker = MarketSummaryRunner(
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
    worker.ensure_consumer_group()

    assert worker.consume_once() == 2
    worker.flush_db_sinks_once()

    assert any(key.endswith("market_summary:latest") for key in redis.strings)
    assert any(key.endswith("market_summary:zset") for key in redis.zsets)
    with SessionLocal() as session:
        rows = session.query(MarketSummary1mModel).filter_by(market_code="TSE001").all()
        assert len(rows) >= 1
