from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest
from app.market_ingestion.runner import MarketIngestionRunner
from app.market_ingestion.shioaji_client import ShioajiClient
from app.services.metrics import Metrics


class _FakeQuote:
    def __init__(self) -> None:
        self.tick_fop_callback = None
        self.quote_fop_callback = None
        self.tick_stk_callback = None
        self.bidask_fop_callback = None
        self.subscriptions: list[tuple[object, object, object | None]] = []

    def set_on_tick_fop_v1_callback(self, callback) -> None:
        self.tick_fop_callback = callback

    def set_on_tick_stk_v1_callback(self, callback) -> None:
        self.tick_stk_callback = callback

    def set_on_quote_fop_v1_callback(self, callback) -> None:
        self.quote_fop_callback = callback

    def set_on_bidask_fop_v1_callback(self, callback) -> None:
        self.bidask_fop_callback = callback

    def on_event(self, callback):
        return callback

    def subscribe(self, contract, quote_type, version=None) -> None:
        self.subscriptions.append((contract, quote_type, version))


class _FakeAPI:
    def __init__(self) -> None:
        self.quote = _FakeQuote()
        self.Contracts = type(
            "Contracts",
            (),
            {
                "Futures": {"MTXR1": object(), "MTX": object()},
                "Stocks": {"2330": object()},
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


class _FakeFuturesTick:
    def __init__(self, code: str, price: float) -> None:
        self.code = code
        self.price = price
        self.datetime = datetime.now(tz=timezone.utc)

    def to_dict(self, raw: bool = True):
        _ = raw
        return {"price": self.price}


class _FakeFuturesQuote:
    def __init__(self, code: str, price: float, volume: int) -> None:
        self.code = code
        self.price = price
        self.volume = volume
        self.datetime = datetime.now(tz=timezone.utc)

    def to_dict(self, raw: bool = True):
        _ = raw
        return {"price": self.price, "volume": self.volume}


class _SelectiveRedis:
    def __init__(self) -> None:
        self.writes: list[tuple[str, dict[str, str]]] = []

    def xadd(self, key, fields, maxlen, approximate):
        _ = (maxlen, approximate)
        if ":stream:spot:" in key:
            raise RuntimeError("spot write failure")
        self.writes.append((key, fields))
        return f"{len(self.writes)}-0"


def _build_runner(
    redis_client, symbols_file: str, expected_count: int, spot_required: bool
) -> MarketIngestionRunner:
    return MarketIngestionRunner(
        shioaji_client=ShioajiClient(
            api=_FakeAPI(),
            api_key="k",
            secret_key="s",
            simulation=True,
        ),
        redis_client=redis_client,
        metrics=Metrics(),
        queue_maxsize=8,
        stream_maxlen=100,
        retry_attempts=1,
        retry_backoff_ms=0,
        spot_symbols_file=symbols_file,
        spot_symbols_expected_count=expected_count,
        spot_required=spot_required,
    )


def test_spot_required_mode_fails_on_invalid_registry(tmp_path) -> None:
    symbols_file = tmp_path / "symbols.txt"
    symbols_file.write_text("ABCD\n", encoding="utf-8")
    runner = _build_runner(
        _SelectiveRedis(), str(symbols_file), expected_count=1, spot_required=True
    )
    with pytest.raises(RuntimeError, match="spot symbol registry validation failed"):
        asyncio.run(runner.start())


def test_spot_optional_mode_disables_spot_on_invalid_registry(tmp_path) -> None:
    symbols_file = tmp_path / "symbols.txt"
    symbols_file.write_text("ABCD\n", encoding="utf-8")
    runner = _build_runner(
        _SelectiveRedis(), str(symbols_file), expected_count=1, spot_required=False
    )
    asyncio.run(runner.start())
    assert runner._spot_enabled is False
    asyncio.run(runner.stop())


def test_spot_stream_contract_and_ingest_seq_monotonic(tmp_path) -> None:
    symbols_file = tmp_path / "symbols.txt"
    symbols_file.write_text("2330\n", encoding="utf-8")
    runner = _build_runner(
        _SelectiveRedis(), str(symbols_file), expected_count=1, spot_required=True
    )
    runner._spot_enabled = True

    runner._on_spot_quote(_FakeSpotTick("2330", 901.5))
    runner._on_spot_quote(_FakeSpotTick("2330", 902.0))

    first = runner._spot_pipeline.queue.get_nowait()
    second = runner._spot_pipeline.queue.get_nowait()
    assert first.stream_key == "dev:stream:spot:2330"
    assert first.event.payload["symbol"] == "2330"
    assert first.event.payload["source"] == "shioaji"
    assert "event_ts" in first.event.payload
    assert "last_price" in first.event.payload
    assert first.event.payload["ingest_seq"] == 1
    assert second.event.payload["ingest_seq"] == 2


def test_futures_path_continues_when_spot_publish_fails(tmp_path, caplog) -> None:
    symbols_file = tmp_path / "symbols.txt"
    symbols_file.write_text("2330\n", encoding="utf-8")
    redis = _SelectiveRedis()
    runner = _build_runner(redis, str(symbols_file), expected_count=1, spot_required=True)

    async def _scenario() -> None:
        await runner.start()
        quote = runner._client.api.quote
        quote.tick_fop_callback(None, _FakeFuturesTick("MTX", 20000))
        quote.tick_stk_callback(None, _FakeSpotTick("2330", 900))
        await asyncio.sleep(0.05)
        await runner.stop()

    caplog.set_level("ERROR")
    asyncio.run(_scenario())

    assert any(stream == "dev:stream:tick:MTX" for stream, _ in redis.writes)
    assert runner._metrics.counters["ingestion_spot_publish_errors_total"] >= 1
    assert "asset_type=spot" in caplog.text
    assert "symbol=2330" in caplog.text


def test_quote_callback_publishes_to_quote_stream(tmp_path) -> None:
    symbols_file = tmp_path / "symbols.txt"
    symbols_file.write_text("2330\n", encoding="utf-8")
    redis = _SelectiveRedis()
    runner = _build_runner(redis, str(symbols_file), expected_count=1, spot_required=True)

    async def _scenario() -> None:
        await runner.start()
        quote = runner._client.api.quote
        assert quote.quote_fop_callback is not None
        quote.quote_fop_callback(None, _FakeFuturesQuote("MTX", 20000, 7))
        await asyncio.sleep(0.05)
        await runner.stop()

    asyncio.run(_scenario())
    assert any(stream == "dev:stream:quote:MTX" for stream, _ in redis.writes)
