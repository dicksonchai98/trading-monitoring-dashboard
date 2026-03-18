from __future__ import annotations

import pytest
from app.market_ingestion.shioaji_subscription import resolve_contract, subscribe_topics


class FakeQuote:
    def __init__(self) -> None:
        self.subscriptions: list[tuple[str, object, object | None]] = []

    def subscribe(self, contract, quote_type, version=None) -> None:
        normalized = str(quote_type).lower()
        if "." in normalized:
            normalized = normalized.split(".")[-1]
        self.subscriptions.append((normalized, contract, version))


class FakeFutures(dict):
    pass


class FakeContracts:
    def __init__(self, futures: FakeFutures) -> None:
        self.Futures = futures


class FakeAPI:
    def __init__(self, futures: FakeFutures) -> None:
        self.Contracts = FakeContracts(futures=futures)
        self.quote = FakeQuote()


def test_resolve_contract_prefers_near_month() -> None:
    near = object()
    base = object()
    api = FakeAPI(FakeFutures({"MTXR1": near, "MTX": base}))
    assert resolve_contract(api, "MTX") is near


def test_subscribe_tick_and_bidask_for_target_contract() -> None:
    contract = object()
    api = FakeAPI(FakeFutures({"MTX": contract}))
    subscribe_topics(api, contract)
    assert any(kind == "tick" and target is contract for kind, target, _ in api.quote.subscriptions)
    assert any(
        kind == "bidask" and target is contract for kind, target, _ in api.quote.subscriptions
    )


def test_subscribe_honors_quote_types() -> None:
    contract = object()
    api = FakeAPI(FakeFutures({"MTX": contract}))
    subscribe_topics(api, contract, ["tick"])
    assert any(kind == "tick" and target is contract for kind, target, _ in api.quote.subscriptions)
    assert all(kind != "bidask" for kind, _, _ in api.quote.subscriptions)


def test_subscribe_bidask_does_not_force_v1_version() -> None:
    contract = object()
    api = FakeAPI(FakeFutures({"MTX": contract}))
    subscribe_topics(api, contract, ["bidask"])

    bidask_subscriptions = [
        (kind, target, version)
        for kind, target, version in api.quote.subscriptions
        if kind == "bidask" and target is contract
    ]
    assert len(bidask_subscriptions) == 1
    assert bidask_subscriptions[0][2] is None


def test_resolve_contract_raises_when_code_not_found() -> None:
    api = FakeAPI(FakeFutures({}))
    with pytest.raises(RuntimeError, match="unable to resolve futures contract"):
        resolve_contract(api, "MTX")


def test_subscribe_topics_raises_when_contract_is_none() -> None:
    api = FakeAPI(FakeFutures({}))
    with pytest.raises(RuntimeError, match="resolved futures contract is empty"):
        subscribe_topics(api, None, ["tick"])
