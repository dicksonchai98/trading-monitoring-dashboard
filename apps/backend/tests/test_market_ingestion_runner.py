from __future__ import annotations

from app.market_ingestion.runner import MarketIngestionRunner, reconnect_delays
from app.market_ingestion.shioaji_client import ShioajiClient
from app.services.metrics import Metrics


class _FakeQuote:
    def set_on_tick_fop_v1_callback(self, _callback) -> None:
        return None

    def set_on_bidask_fop_v1_callback(self, _callback) -> None:
        return None

    def on_event(self, callback):
        return callback


class _FakeContracts:
    class Futures(dict):
        pass

    def __init__(self) -> None:
        self.Futures = self.Futures()


class _FakeAPI:
    def __init__(self) -> None:
        self.quote = _FakeQuote()
        self.Contracts = _FakeContracts()

    def login(self, **_kwargs):
        return ["account"]

    def fetch_contracts(self, **_kwargs):
        return None

    def logout(self):
        return None


class _FakeRedis:
    def xadd(self, *_args, **_kwargs):
        return "1-0"


class _FakeMarketQuote:
    def __init__(self) -> None:
        self.code = "TSE001"
        self.datetime = "2026-04-06T10:30:01+08:00"

    def to_dict(self, raw: bool = True):  # noqa: ARG002
        return {
            "index_value": 21000.0,
            "cumulative_turnover": 123456789,
        }


def test_reconnect_backoff_is_exponential_and_capped() -> None:
    assert reconnect_delays(6) == [1, 2, 4, 8, 16, 30]


def test_quote_event_disconnect_codes_trigger_reconnect() -> None:
    runner = MarketIngestionRunner(
        shioaji_client=ShioajiClient(
            api=_FakeAPI(),
            api_key="k",
            secret_key="s",
            simulation=True,
        ),
        redis_client=_FakeRedis(),
        metrics=Metrics(),
        queue_maxsize=8,
        stream_maxlen=100,
        retry_attempts=2,
        retry_backoff_ms=10,
    )
    called: list[str] = []
    runner._schedule_reconnect = lambda *_args: called.append("reconnect")  # type: ignore[attr-defined]
    runner._schedule_resubscribe = lambda *_args: called.append("resubscribe")  # type: ignore[attr-defined]

    runner._on_quote_event(0, 2, "", "")
    runner._on_quote_event(0, 3, "", "")
    runner._on_quote_event(0, 12, "", "")

    assert called == ["reconnect", "reconnect", "reconnect"]


def test_quote_event_reconnected_codes_trigger_resubscribe() -> None:
    runner = MarketIngestionRunner(
        shioaji_client=ShioajiClient(
            api=_FakeAPI(),
            api_key="k",
            secret_key="s",
            simulation=True,
        ),
        redis_client=_FakeRedis(),
        metrics=Metrics(),
        queue_maxsize=8,
        stream_maxlen=100,
        retry_attempts=2,
        retry_backoff_ms=10,
    )
    called: list[str] = []
    runner._schedule_reconnect = lambda *_args: called.append("reconnect")  # type: ignore[attr-defined]
    runner._schedule_resubscribe = lambda *_args: called.append("resubscribe")  # type: ignore[attr-defined]

    runner._on_quote_event(0, 4, "", "")
    runner._on_quote_event(0, 13, "", "")
    runner._on_quote_event(0, 16, "", "")

    assert called == ["resubscribe", "resubscribe"]


def test_market_quote_is_enqueued_to_market_stream() -> None:
    runner = MarketIngestionRunner(
        shioaji_client=ShioajiClient(
            api=_FakeAPI(),
            api_key="k",
            secret_key="s",
            simulation=True,
        ),
        redis_client=_FakeRedis(),
        metrics=Metrics(),
        queue_maxsize=8,
        stream_maxlen=100,
        retry_attempts=2,
        retry_backoff_ms=10,
    )
    runner._market_enabled = True
    runner._market_code = "TSE001"
    quote = _FakeMarketQuote()
    runner._on_market_quote(quote)
    queued = runner._futures_pipeline.queue.get_nowait()
    assert queued.stream_key == "dev:stream:market:TSE001"
    assert queued.event.quote_type == "market"


def test_market_quote_dict_payload_is_enqueued_to_canonical_market_stream() -> None:
    runner = MarketIngestionRunner(
        shioaji_client=ShioajiClient(
            api=_FakeAPI(),
            api_key="k",
            secret_key="s",
            simulation=True,
        ),
        redis_client=_FakeRedis(),
        metrics=Metrics(),
        queue_maxsize=8,
        stream_maxlen=100,
        retry_attempts=2,
        retry_backoff_ms=10,
    )
    runner._market_enabled = True
    runner._market_code = "TSE001"

    quote_payload = {
        "Code": "001",
        "Date": "2026/04/08",
        "Time": "10:00:00.000000",
        "Close": 34560.5,
        "AmountSum": 123456789.0,
    }
    runner._on_market_quote(quote_payload)

    queued = runner._futures_pipeline.queue.get_nowait()
    assert queued.stream_key == "dev:stream:market:TSE001"
    assert queued.event.code == "TSE001"
    assert queued.event.payload["index_value"] == 34560.5
    assert queued.event.payload["cumulative_turnover"] == 123456789.0
