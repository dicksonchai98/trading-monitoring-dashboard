"""Historical data fetcher with simple rate limiting."""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Callable

from app.market_ingestion.shioaji_client import ShioajiClient
from app.market_ingestion.shioaji_subscription import resolve_contract
from app.services.shioaji_session import build_shioaji_client


@dataclass
class HistoricalFetcher:
    client_factory: Callable[[], ShioajiClient] = build_shioaji_client
    min_interval_seconds: float = 0.0
    _client: ShioajiClient | None = None
    _contract_cache: dict[str, Any] | None = None
    _last_call_at: float = 0.0

    def _wait_rate_limit(self) -> None:
        if self.min_interval_seconds <= 0:
            return
        if self._last_call_at == 0:
            self._last_call_at = time.monotonic()
            return
        now = time.monotonic()
        elapsed = now - self._last_call_at
        if elapsed < self.min_interval_seconds:
            time.sleep(self.min_interval_seconds - elapsed)
        self._last_call_at = time.monotonic()

    def fetch_bars(self, *, code: str, start_date: date, end_date: date) -> list[dict[str, Any]]:
        self._wait_rate_limit()
        if self._client is None:
            self._client = self.client_factory()
            self._client.login()
            self._client.fetch_contracts()
            self._contract_cache = {}
        api = self._client.api
        if self._contract_cache is None:
            self._contract_cache = {}
        contract = self._contract_cache.get(code)
        if contract is None:
            contract = resolve_contract(api, code)
            self._contract_cache[code] = contract
        if hasattr(api, "kbars"):
            # Contract lookup shape depends on vendor SDK, keep wrapper flexible.
            return self._normalize_kbars(
                api.kbars(
                    contract=contract,
                    start=start_date.isoformat(),
                    end=end_date.isoformat(),
                )
            )
        raise RuntimeError("historical_fetch_not_supported")

    @staticmethod
    def _normalize_kbars(payload: Any) -> list[dict[str, Any]]:
        if isinstance(payload, dict):
            return HistoricalFetcher._rows_from_columnar(payload)

        if hasattr(payload, "model_dump"):
            return HistoricalFetcher._rows_from_columnar(payload.model_dump())

        if hasattr(payload, "dict"):
            return HistoricalFetcher._rows_from_columnar(payload.dict())

        return list(payload)

    @staticmethod
    def _rows_from_columnar(columns: dict[str, Any]) -> list[dict[str, Any]]:
        timestamps = list(columns.get("ts", []))
        opens = list(columns.get("Open", columns.get("open", [])))
        highs = list(columns.get("High", columns.get("high", [])))
        lows = list(columns.get("Low", columns.get("low", [])))
        closes = list(columns.get("Close", columns.get("close", [])))
        volumes = list(columns.get("Volume", columns.get("volume", [])))

        row_count = min(
            len(timestamps), len(opens), len(highs), len(lows), len(closes), len(volumes)
        )
        rows: list[dict[str, Any]] = []
        for index in range(row_count):
            rows.append(
                {
                    "ts": HistoricalFetcher._normalize_ts(timestamps[index]),
                    "open": opens[index],
                    "high": highs[index],
                    "low": lows[index],
                    "close": closes[index],
                    "volume": volumes[index],
                }
            )
        return rows

    @staticmethod
    def _normalize_ts(raw: Any) -> str | Any:
        if isinstance(raw, int):
            return datetime.fromtimestamp(raw / 1_000_000_000, tz=timezone.utc).isoformat()
        return raw
