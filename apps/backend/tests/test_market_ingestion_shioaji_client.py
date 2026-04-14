from __future__ import annotations

from app.market_ingestion.shioaji_client import ShioajiClient


class FakeQuote:
    def __init__(self) -> None:
        self.on_event_callback = None
        self.on_tick_stk_callback = None
        self.on_quote_stk_callback = None
        self.on_tick_idx_callback = None
        self.quote_callback = None
        self.on_quote_fop_callback = None

    def set_on_tick_fop_v1_callback(self, _callback) -> None:
        return None

    def set_on_bidask_fop_v1_callback(self, _callback) -> None:
        return None

    def set_on_quote_fop_v1_callback(self, callback) -> None:
        self.on_quote_fop_callback = callback

    def set_on_tick_stk_v1_callback(self, callback) -> None:
        self.on_tick_stk_callback = callback

    def set_on_quote_stk_v1_callback(self, callback) -> None:
        self.on_quote_stk_callback = callback

    def set_on_tick_idx_v1_callback(self, callback) -> None:
        self.on_tick_idx_callback = callback

    def set_quote_callback(self, callback) -> None:
        self.quote_callback = callback

    def on_event(self, callback):
        self.on_event_callback = callback
        return callback


class FakeAPI:
    def __init__(self) -> None:
        self.login_called = False
        self.logout_called = False
        self.fetch_contracts_called = False
        self.quote = FakeQuote()

    def login(self, **_kwargs):
        self.login_called = True
        return ["account"]

    def fetch_contracts(self, **_kwargs):
        self.fetch_contracts_called = True
        return None

    def logout(self):
        self.logout_called = True
        return None


def _fake_secret() -> str:
    return "test-secret"


def test_login_calls_shioaji_api_login() -> None:
    api = FakeAPI()
    client = ShioajiClient(api=api, api_key="k", secret_key=_fake_secret(), simulation=True)
    client.login()
    assert api.login_called is True


def test_logout_calls_shioaji_api_logout() -> None:
    api = FakeAPI()
    client = ShioajiClient(api=api, api_key="k", secret_key=_fake_secret(), simulation=True)
    client.logout()
    assert api.logout_called is True


def test_set_on_event_callback_registers_quote_event_handler() -> None:
    api = FakeAPI()
    client = ShioajiClient(api=api, api_key="k", secret_key=_fake_secret(), simulation=True)

    def _callback(*_args):
        return None

    client.set_on_event_callback(_callback)
    assert api.quote.on_event_callback is _callback


def test_set_on_tick_stk_callback_registers_handler() -> None:
    api = FakeAPI()
    client = ShioajiClient(api=api, api_key="k", secret_key=_fake_secret(), simulation=True)

    def _callback(*_args):
        return None

    client.set_on_tick_stk_v1_callback(_callback)
    assert api.quote.on_tick_stk_callback is _callback


def test_set_on_market_callback_uses_topic_quote_callback_when_available() -> None:
    api = FakeAPI()
    client = ShioajiClient(api=api, api_key="k", secret_key=_fake_secret(), simulation=True)
    seen: list[tuple[object, object]] = []

    def _callback(*args):
        seen.append((args[0], args[-1]))

    ok = client.set_on_market_callback(_callback)
    assert ok is True
    assert api.quote.quote_callback is not None

    # Non-index topics should be ignored.
    api.quote.quote_callback("TIC/v1/FOP/*/TFE/TXF", {"code": "TXF"})
    assert seen == []

    # Index topic should be forwarded.
    payload = {"Code": "001"}
    api.quote.quote_callback("I/TSE/001", payload)
    assert seen == [("I/TSE/001", payload)]

    assert api.quote.on_quote_stk_callback is None
    assert api.quote.on_tick_idx_callback is None


def test_set_on_quote_fop_callback_registers_handler() -> None:
    api = FakeAPI()
    client = ShioajiClient(api=api, api_key="k", secret_key=_fake_secret(), simulation=True)

    def _callback(*_args):
        return None

    client.set_on_quote_fop_v1_callback(_callback)
    assert api.quote.on_quote_fop_callback is _callback
