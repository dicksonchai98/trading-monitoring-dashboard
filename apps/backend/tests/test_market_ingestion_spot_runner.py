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
                "Futures": {
                    "TXFR1": object(),
                    "TXF": object(),
                    "MTXR1": object(),
                    "MTX": object(),
                },
                "Stocks": {"2330": object()},
                "Indexs": {"001": object()},
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
        self.open = price - 2
        self.high = price + 3
        self.low = price - 4
        self.close = price
        self.reference_price = price - 5
        self.datetime = datetime.now(tz=timezone.utc)

    def to_dict(self, raw: bool = True):
        _ = raw
        return {
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "reference_price": self.reference_price,
        }


class _FakeSpotTickStringPayload:
    def __init__(self, code: str) -> None:
        self.code = code
        self.datetime = datetime.now(tz=timezone.utc)

    def to_dict(self, raw: bool = True):
        _ = raw
        return {
            "open": "899.5",
            "high": "904.5",
            "low": "897.5",
            "close": "901.5",
            "reference_price": "896.5",
            "price_chg": "5.0",
            "pcct_chg": "0.56",
        }


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
        if key.endswith(":stream:spot"):
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
    with pytest.raises(RuntimeError, match="no valid symbols after sanitization"):
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


def test_spot_required_mode_skips_invalid_registry_rows_when_valid_symbols_remain(
    tmp_path,
) -> None:
    symbols_file = tmp_path / "symbols.txt"
    symbols_file.write_text("2330\nABCD\n2330\n", encoding="utf-8")
    runner = _build_runner(
        _SelectiveRedis(), str(symbols_file), expected_count=3, spot_required=True
    )

    asyncio.run(runner.start())
    assert runner._spot_enabled is True
    assert runner._spot_symbols == ["2330"]
    asyncio.run(runner.stop())


def test_spot_required_mode_skips_unresolved_contracts_when_valid_symbols_remain(
    tmp_path,
) -> None:
    symbols_file = tmp_path / "symbols.txt"
    symbols_file.write_text("2330\n2317\n", encoding="utf-8")
    runner = _build_runner(
        _SelectiveRedis(), str(symbols_file), expected_count=2, spot_required=True
    )

    asyncio.run(runner.start())
    assert runner._spot_enabled is True
    assert runner._spot_symbols == ["2330"]
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
    assert first.stream_key == "dev:stream:spot"
    assert first.event.payload["symbol"] == "2330"
    assert first.event.payload["source"] == "shioaji"
    assert "event_ts" in first.event.payload
    assert "last_price" in first.event.payload
    assert first.event.payload["open"] == 899.5
    assert first.event.payload["high"] == 904.5
    assert first.event.payload["low"] == 897.5
    assert first.event.payload["close"] == 901.5
    assert first.event.payload["reference_price"] == 896.5
    assert first.event.payload["ingest_seq"] == 1
    assert second.event.payload["ingest_seq"] == 2


def test_spot_price_fields_support_numeric_strings_in_raw_payload(tmp_path) -> None:
    symbols_file = tmp_path / "symbols.txt"
    symbols_file.write_text("2330\n", encoding="utf-8")
    runner = _build_runner(
        _SelectiveRedis(), str(symbols_file), expected_count=1, spot_required=True
    )
    runner._spot_enabled = True

    runner._on_spot_quote(_FakeSpotTickStringPayload("2330"))

    first = runner._spot_pipeline.queue.get_nowait()
    assert first.stream_key == "dev:stream:spot"
    assert first.event.payload["last_price"] == 901.5
    assert first.event.payload["open"] == 899.5
    assert first.event.payload["high"] == 904.5
    assert first.event.payload["low"] == 897.5
    assert first.event.payload["close"] == 901.5
    assert first.event.payload["reference_price"] == 896.5
    assert first.event.payload["price_chg"] == 5.0
    assert first.event.payload["pct_chg"] == 0.56


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
