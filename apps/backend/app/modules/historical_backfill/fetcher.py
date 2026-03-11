"""Historical data fetcher with simple rate limiting."""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import date
from typing import Any, Callable

from app.market_ingestion.shioaji_client import ShioajiClient
from app.services.shioaji_session import build_shioaji_client


@dataclass
class HistoricalFetcher:
    client_factory: Callable[[], ShioajiClient] = build_shioaji_client
    min_interval_seconds: float = 0.0
    _client: ShioajiClient | None = None
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
        api = self._client.api
        if hasattr(api, "kbars"):
            # Contract lookup shape depends on vendor SDK, keep wrapper flexible.
            return list(
                api.kbars(
                    contract=code,
                    start=start_date.isoformat(),
                    end=end_date.isoformat(),
                )
            )
        raise RuntimeError("historical_fetch_not_supported")
