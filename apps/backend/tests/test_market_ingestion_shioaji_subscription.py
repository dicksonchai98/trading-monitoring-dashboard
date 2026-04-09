from __future__ import annotations

import pytest
from app.market_ingestion.shioaji_subscription import (
    resolve_contract,
    resolve_market_contract,
    resolve_stock_contract,
    subscribe_market_topic,
    subscribe_spot_ticks,
    subscribe_topics,
)


class FakeQuote:
    def __init__(self) -> None:
        self.subscriptions: list[tuple[str, object, object | None]] = []

    def subscribe(self, contract, quote_type, version=None) -> None:
        normalized = str(quote_type).lower()
        if "." in normalized:
            normalized = normalized.split(".")[-1]
        self.subscriptions.append((normalized, contract, version))


class FallbackQuote(FakeQuote):
    def subscribe(self, contract, quote_type, version=None) -> None:
        normalized = str(quote_type).lower()
        if "." in normalized:
            normalized = normalized.split(".")[-1]
        if normalized == "quote":
            raise RuntimeError("Quote type not supported")
        self.subscriptions.append((normalized, contract, version))


class FakeFutures(dict):
    pass


class FakeContracts:
    def __init__(
        self,
        futures: FakeFutures,
        stocks: dict[str, object] | None = None,
        indices: dict[str, object] | None = None,
    ) -> None:
        self.Futures = futures
        self.Stocks = stocks or {}
        self.Indexs = indices or {}


class GetOnlyBucket:
    def __init__(self, mapping: dict[str, object]) -> None:
        self._mapping = mapping

    def get(self, key: str) -> object | None:
        return self._mapping.get(key)


class StocksByMarket:
    def __init__(
        self,
        tse: dict[str, object] | None = None,
        otc: dict[str, object] | None = None,
        oes: dict[str, object] | None = None,
    ) -> None:
        self.TSE = tse or {}
        self.OTC = otc or {}
        self.OES = oes or {}


class FakeAPI:
    def __init__(
        self,
        futures: FakeFutures,
        stocks: dict[str, object] | None = None,
        indices: dict[str, object] | None = None,
    ) -> None:
        self.Contracts = FakeContracts(futures=futures, stocks=stocks, indices=indices)
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


def test_subscribe_supports_quote_type() -> None:
    contract = object()
    api = FakeAPI(FakeFutures({"MTX": contract}))
    subscribe_topics(api, contract, ["quote"])
    assert any(
        kind == "quote" and target is contract for kind, target, _ in api.quote.subscriptions
    )


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


def test_resolve_stock_contract_from_stocks() -> None:
    stock_contract = object()
    api = FakeAPI(FakeFutures({}), stocks={"2330": stock_contract})
    assert resolve_stock_contract(api, "2330") is stock_contract


def test_subscribe_spot_ticks_for_symbols() -> None:
    contract_2330 = object()
    contract_2317 = object()
    api = FakeAPI(
        FakeFutures({}),
        stocks={"2330": contract_2330, "2317": contract_2317},
    )
    subscribed = subscribe_spot_ticks(api, ["2330", "2317"])
    assert subscribed == 2
    assert any(target is contract_2330 for _, target, _ in api.quote.subscriptions)
    assert any(target is contract_2317 for _, target, _ in api.quote.subscriptions)


def test_resolve_stock_contract_from_tse_bucket() -> None:
    contract_1704 = object()
    api = FakeAPI(FakeFutures({}), stocks={})
    api.Contracts.Stocks = StocksByMarket(tse={"1704": contract_1704})
    assert resolve_stock_contract(api, "1704") is contract_1704


def test_resolve_stock_contract_from_otc_bucket() -> None:
    contract_5483 = object()
    api = FakeAPI(FakeFutures({}), stocks={})
    api.Contracts.Stocks = StocksByMarket(otc={"5483": contract_5483})
    assert resolve_stock_contract(api, "5483") is contract_5483


def test_resolve_market_contract_prefers_index_bucket() -> None:
    idx_contract = object()
    api = FakeAPI(FakeFutures({}), indices={"TSE001": idx_contract})
    assert resolve_market_contract(api, "TSE001") is idx_contract


def test_resolve_market_contract_accepts_tse_prefixed_code_for_numeric_index_bucket() -> None:
    idx_contract = object()
    api = FakeAPI(FakeFutures({}), indices={"001": idx_contract})
    assert resolve_market_contract(api, "TSE001") is idx_contract


def test_resolve_market_contract_with_get_only_bucket() -> None:
    idx_contract = object()
    api = FakeAPI(FakeFutures({}), indices={})
    api.Contracts.Indexs = GetOnlyBucket({"001": idx_contract})
    assert resolve_market_contract(api, "TSE001") is idx_contract


def test_subscribe_market_topic_subscribes_quote_v1() -> None:
    idx_contract = object()
    api = FakeAPI(FakeFutures({}), indices={"TSE001": idx_contract})
    subscribe_market_topic(api, idx_contract)
    assert any(
        kind == "quote" and target is idx_contract for kind, target, _ in api.quote.subscriptions
    )


def test_subscribe_market_topic_falls_back_to_tick_when_quote_not_supported() -> None:
    idx_contract = object()
    api = FakeAPI(FakeFutures({}), indices={"TSE001": idx_contract})
    api.quote = FallbackQuote()
    subscribe_market_topic(api, idx_contract)
    assert any(
        kind == "tick" and target is idx_contract for kind, target, _ in api.quote.subscriptions
    )
