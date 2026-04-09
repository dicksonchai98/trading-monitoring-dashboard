from __future__ import annotations

from app.services.serving_store import normalize_kbar


def test_normalize_kbar_includes_day_amplitude_when_present() -> None:
    payload = normalize_kbar(
        {
            "code": "TXFD6",
            "trade_date": "2026-04-09",
            "minute_ts": "2026-04-09T11:00:00+08:00",
            "open": "20000",
            "high": "20100",
            "low": "19950",
            "close": "20080",
            "volume": "120",
            "amplitude": "150",
            "amplitude_pct": "0.0075",
            "day_amplitude": "320",
        }
    )

    assert payload["day_amplitude"] == 320.0


def test_normalize_kbar_sets_day_amplitude_none_for_invalid_value() -> None:
    payload = normalize_kbar(
        {
            "code": "TXFD6",
            "trade_date": "2026-04-09",
            "minute_ts": "2026-04-09T11:00:00+08:00",
            "open": "20000",
            "high": "20100",
            "low": "19950",
            "close": "20080",
            "volume": "120",
            "amplitude": "150",
            "amplitude_pct": "0.0075",
            "day_amplitude": "None",
        }
    )

    assert payload["day_amplitude"] is None
