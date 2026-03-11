from __future__ import annotations

from datetime import date

import pytest
from app.modules.historical_backfill.fetcher import HistoricalFetcher


class _FakeApi:
    def __init__(self) -> None:
        self.calls = 0

    def kbars(self, *, contract, start, end):  # type: ignore[no-untyped-def]
        self.calls += 1
        return [{"contract": contract, "start": start, "end": end}]


class _FakeClient:
    def __init__(self) -> None:
        self.api = _FakeApi()
        self.login_calls = 0
        self.fetch_contract_calls = 0

    def login(self) -> None:
        self.login_calls += 1

    def fetch_contracts(self) -> None:
        self.fetch_contract_calls += 1


def test_fetcher_reuses_session_and_applies_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeClient()
    sleeps: list[float] = []
    ticks = iter([100.2, 100.2, 102.0, 102.0])

    monkeypatch.setattr("time.sleep", lambda seconds: sleeps.append(seconds))
    monkeypatch.setattr("time.monotonic", lambda: next(ticks))
    fetcher = HistoricalFetcher(client_factory=lambda: fake, min_interval_seconds=1.0)
    fetcher._last_call_at = 100.0

    first = fetcher.fetch_bars(code="TXF", start_date=date(2026, 3, 1), end_date=date(2026, 3, 1))
    second = fetcher.fetch_bars(code="TXF", start_date=date(2026, 3, 2), end_date=date(2026, 3, 2))

    assert len(first) == 1
    assert len(second) == 1
    assert fake.login_calls == 1
    assert fake.fetch_contract_calls == 1
    assert fake.api.calls == 2
    assert sleeps == [pytest.approx(0.8)]
