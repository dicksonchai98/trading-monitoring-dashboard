"""Shioaji futures contract resolution and quote subscription helpers."""

from __future__ import annotations

from collections.abc import Iterable
from contextlib import suppress
from typing import Any


def _quote_type(value: str) -> Any:
    try:
        import shioaji as sj  # type: ignore

        mapping = {
            "tick": "Tick",
            "bidask": "BidAsk",
            "quote": "Quote",
        }
        attr = mapping.get(value, "BidAsk")
        quote_type = getattr(sj.constant.QuoteType, attr, None)
        if quote_type is not None:
            return quote_type
        return value
    except Exception:
        return value


def _quote_version_v1() -> Any:
    try:
        import shioaji as sj  # type: ignore

        return sj.constant.QuoteVersion.v1
    except Exception:
        return "v1"


def _resolve_from_futures(futures: Any, code: str) -> Any:
    if hasattr(futures, "__getitem__"):
        with suppress(Exception):
            contract = futures[code]
            if contract is not None:
                return contract
    contract = getattr(futures, code, None)
    if contract is not None:
        return contract
    return None


def _resolve_from_stocks(stocks: Any, code: str) -> Any:
    if hasattr(stocks, "__getitem__"):
        with suppress(Exception):
            contract = stocks[code]
            if contract is not None:
                return contract
    contract = getattr(stocks, code, None)
    if contract is not None:
        return contract
    return None


def _available_futures_codes(futures: Any, limit: int = 20) -> list[str]:
    if hasattr(futures, "keys"):
        try:
            return [str(key) for key in list(futures.keys())[:limit]]
        except Exception:
            return []
    names = [name for name in dir(futures) if not name.startswith("_")]
    return names[:limit]


def _available_stock_codes(stocks: Any, limit: int = 20) -> list[str]:
    if hasattr(stocks, "keys"):
        try:
            return [str(key) for key in list(stocks.keys())[:limit]]
        except Exception:
            return []
    names = [name for name in dir(stocks) if not name.startswith("_")]
    return names[:limit]


def resolve_contract(api: Any, code: str) -> Any:
    # Prefer near-month shorthand (e.g., TXFR1 / MTXR1) when available.
    near_month_code = f"{code}R1"
    futures = api.Contracts.Futures
    candidates = [near_month_code, code]
    for candidate in candidates:
        contract = _resolve_from_futures(futures, candidate)
        if contract is not None:
            return contract
    raise RuntimeError(
        "unable to resolve futures contract "
        f"code={code} candidates={candidates} available={_available_futures_codes(futures)}"
    )


def resolve_market_contract(api: Any, code: str) -> Any:
    contracts = getattr(api, "Contracts", None)
    if contracts is None:
        raise RuntimeError("unable to resolve market contract: contracts unavailable")
    for attr in ("Indexs", "Indices", "Stocks", "Futures"):
        bucket = getattr(contracts, attr, None)
        if bucket is None:
            continue
        contract = _resolve_from_stocks(bucket, code)
        if contract is None:
            contract = _resolve_from_futures(bucket, code)
        if contract is not None:
            return contract
    raise RuntimeError(f"unable to resolve market contract code={code}")


def subscribe_topics(api: Any, contract: Any, quote_types: Iterable[str] | None = None) -> None:
    if contract is None:
        raise RuntimeError("resolved futures contract is empty; cannot subscribe topics")
    quote = api.quote
    types = list(quote_types) if quote_types is not None else ["tick", "bidask"]
    allowed = {"tick", "bidask", "quote"}
    seen: set[str] = set()
    for value in types:
        normalized = value.strip().lower()
        if normalized in allowed and normalized not in seen:
            if normalized == "tick":
                quote.subscribe(
                    contract, quote_type=_quote_type(normalized), version=_quote_version_v1()
                )
            else:
                # BidAsk v1 payloads can be unstable in some sessions.
                # Fall back to SDK default version.
                quote.subscribe(contract, quote_type=_quote_type(normalized))
            seen.add(normalized)


def resolve_stock_contract(api: Any, symbol: str) -> Any:
    stocks = api.Contracts.Stocks
    contract = _resolve_from_stocks(stocks, symbol)
    if contract is not None:
        return contract
    raise RuntimeError(
        "unable to resolve stock contract "
        f"symbol={symbol} available={_available_stock_codes(stocks)}"
    )


def subscribe_spot_ticks(api: Any, symbols: Iterable[str]) -> int:
    quote = api.quote
    subscribed = 0
    for symbol in symbols:
        contract = resolve_stock_contract(api, symbol)
        quote.subscribe(contract, quote_type=_quote_type("tick"), version=_quote_version_v1())
        subscribed += 1
    return subscribed


def subscribe_market_topic(api: Any, contract: Any) -> None:
    if contract is None:
        raise RuntimeError("resolved market contract is empty; cannot subscribe topic")
    api.quote.subscribe(contract, quote_type=_quote_type("tick"), version=_quote_version_v1())
