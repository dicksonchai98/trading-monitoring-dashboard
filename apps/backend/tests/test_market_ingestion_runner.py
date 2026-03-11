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
