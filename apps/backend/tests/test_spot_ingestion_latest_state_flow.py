from __future__ import annotations

import asyncio
import fnmatch
import json
from datetime import datetime, timezone
from typing import Any

from app.latest_state.runner import LatestStateRunner
from app.market_ingestion.runner import MarketIngestionRunner
from app.market_ingestion.shioaji_client import ShioajiClient
from app.services.metrics import Metrics


class _FakeQuote:
    def __init__(self) -> None:
        self.tick_fop_callback = None
        self.tick_stk_callback = None
        self.bidask_fop_callback = None
        self.subscriptions: list[tuple[object, object, object | None]] = []

    def set_on_tick_fop_v1_callback(self, callback) -> None:
        self.tick_fop_callback = callback

    def set_on_tick_stk_v1_callback(self, callback) -> None:
        self.tick_stk_callback = callback

    def set_on_bidask_fop_v1_callback(self, callback) -> None:
        self.bidask_fop_callback = callback

    def on_event(self, callback):
        return callback

    def subscribe(self, contract, quote_type, version=None) -> None:
        self.subscriptions.append((contract, quote_type, version))


class _StocksByMarket:
    def __init__(self, tse: dict[str, object] | None = None) -> None:
        self.TSE = tse or {}
        self.OTC = {}
        self.OES = {}


class _FakeAPI:
    def __init__(self) -> None:
        self.quote = _FakeQuote()
        self.Contracts = type(
            "Contracts",
            (),
            {
                "Futures": {
                    "TXFR1": object(),
                    "TXF": object(),
                    "MTXR1": object(),
                    "MTX": object(),
                },
                "Stocks": _StocksByMarket(tse={"2330": object()}),
            },
        )

    def login(self, **_kwargs):
        return ["ok"]

    def fetch_contracts(self, **_kwargs):
        return None

    def logout(self):
        return None


class _FakeSpotTick:
    def __init__(self, code: str, price: float) -> None:
        self.code = code
        self.close = price
        self.datetime = datetime.now(tz=timezone.utc)

    def to_dict(self, raw: bool = True):
        _ = raw
        return {"close": self.close}


class _FlowRedis:
    def __init__(self) -> None:
        self.streams: dict[str, list[tuple[str, dict[str, str]]]] = {}
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

    def xgroup_create(self, key, group, stream_id="0-0", mkstream=False, **kwargs):
        _ = (group, stream_id, mkstream, kwargs)
        self.streams.setdefault(key, [])

    def xreadgroup(self, groupname, consumername, streams, count=1, block=0):
        _ = (groupname, consumername, block)
        result = []
        for stream_key in streams:
            entries = self.streams.get(stream_key, [])
            if not entries:
                continue
            take = min(count or len(entries), len(entries))
            batch = entries[:take]
            self.streams[stream_key] = entries[take:]
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
        self.strings[key] = value

    def expire(self, key, ttl):
        self.expirations[key] = ttl

    def pipeline(self, transaction=False):
        _ = transaction
        return _FlowPipeline(self)


class _FlowPipeline:
    def __init__(self, redis: _FlowRedis) -> None:
        self._redis = redis
        self._ops: list[tuple[str, str, Any]] = []

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


def test_spot_callback_to_stream_to_latest_state_end_to_end(tmp_path) -> None:
    symbols_file = tmp_path / "symbols.txt"
    symbols_file.write_text("2330\n", encoding="utf-8")
    redis = _FlowRedis()

    runner = MarketIngestionRunner(
        shioaji_client=ShioajiClient(
            api=_FakeAPI(),
            api_key="k",
            secret_key="s",
            simulation=True,
        ),
        redis_client=redis,
        metrics=Metrics(),
        queue_maxsize=8,
        stream_maxlen=100,
        retry_attempts=1,
        retry_backoff_ms=0,
        spot_symbols_file=str(symbols_file),
        spot_symbols_expected_count=1,
        spot_required=True,
    )
    runner._market_enabled = False

    async def _ingest_once() -> None:
        await runner.start()
        runner._client.api.quote.tick_stk_callback(None, _FakeSpotTick("2330", 612.0))
        await asyncio.sleep(0.05)
        await runner.stop()

    asyncio.run(_ingest_once())

    stream_key = "dev:stream:spot"
    assert stream_key in redis.streams
    assert len(redis.streams[stream_key]) == 1

    latest_runner = LatestStateRunner(
        redis_client=redis,
        metrics=Metrics(),
        env="dev",
        group="latest-state:spot",
        consumer="latest-state-1",
        read_count=100,
        block_ms=0,
        claim_idle_ms=1000,
        claim_count=100,
        flush_interval_ms=1,
    )

    assert latest_runner.consume_once() == 1
    state_key = "dev:state:spot:2330:latest"
    assert state_key in redis.strings
    state = json.loads(redis.strings[state_key])
    assert state["open"] == 612.0
    assert state["high"] == 612.0
    assert state["low"] == 612.0
    assert state["close"] == 612.0
    assert redis.acks
