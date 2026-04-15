from __future__ import annotations

import json

from app.services import serving_store


class _FakeRedis:
    def __init__(self, payload: dict[str, object] | None = None) -> None:
        self._payload = payload

    def get(self, _key: str):
        if self._payload is None:
            return None
        return json.dumps(self._payload, ensure_ascii=True)


class _FakeRedisByKey:
    def __init__(self, payload_by_key: dict[str, dict[str, object]]) -> None:
        self._payload_by_key = payload_by_key

    def get(self, key: str):
        payload = self._payload_by_key.get(key)
        if payload is None:
            return None
        return json.dumps(payload, ensure_ascii=True)


class _FakeRedisSpotDistribution:
    def __init__(
        self, latest_payload: dict[str, object] | None, series_payloads: list[dict[str, object]]
    ) -> None:
        self._latest_payload = latest_payload
        self._series_payloads = series_payloads

    def get(self, _key: str):
        if self._latest_payload is None:
            return None
        return json.dumps(self._latest_payload, ensure_ascii=True)

    def zrangebyscore(self, _key: str, _start: float, _end: float):
        return [json.dumps(payload, ensure_ascii=True) for payload in self._series_payloads]


def test_normalize_spot_latest_converts_updated_at_to_epoch_ms() -> None:
    payload = serving_store.normalize_spot_latest(
        {
            "symbol": "2330",
            "last_price": 612.0,
            "updated_at": "2026-04-09T13:45:00+08:00",
        }
    )
    assert payload["updated_at"] == 1775713500000


def test_fetch_spot_latest_reads_redis_payload(monkeypatch) -> None:
    monkeypatch.setattr(
        serving_store,
        "get_serving_redis_client",
        lambda: _FakeRedis(
            {
                "symbol": "2330",
                "open": 610.0,
                "high": 620.0,
                "low": 600.0,
                "close": 612.0,
                "last_price": 612.0,
                "session_high": 620.0,
                "session_low": 600.0,
                "reference_price": 607.0,
                "price_chg": 5.0,
                "pct_chg": 0.82,
                "gap_value": 3.0,
                "gap_pct": 0.4942339373970346,
                "is_gap_up": True,
                "is_gap_down": False,
                "is_new_high": True,
                "is_new_low": False,
                "strength_state": "new_high",
                "strength_score": 2,
                "updated_at": "2026-04-09T13:45:00+08:00",
            }
        ),
    )

    payload = serving_store.fetch_spot_latest("2330")
    assert payload is not None
    assert payload["symbol"] == "2330"
    assert payload["updated_at"] == 1775713500000


def test_fetch_spot_latest_returns_none_when_missing(monkeypatch) -> None:
    monkeypatch.setattr(serving_store, "get_serving_redis_client", lambda: _FakeRedis(None))
    assert serving_store.fetch_spot_latest("2330") is None


def test_fetch_spot_latest_list_keeps_registry_order_and_null_fallback(monkeypatch) -> None:
    monkeypatch.setattr(serving_store, "_load_spot_symbols", lambda: ["2330", "2317"])
    monkeypatch.setattr(
        serving_store,
        "get_serving_redis_client",
        lambda: _FakeRedisByKey(
            {
                "dev:state:spot:2330:latest": {
                    "symbol": "2330",
                    "open": 610.0,
                    "high": 620.0,
                    "low": 600.0,
                    "close": 612.0,
                    "last_price": 612.0,
                    "session_high": 620.0,
                    "session_low": 600.0,
                    "reference_price": 607.0,
                    "price_chg": 5.0,
                    "pct_chg": 0.82,
                    "gap_value": 3.0,
                    "gap_pct": 0.4942339373970346,
                    "is_gap_up": True,
                    "is_gap_down": False,
                    "is_new_high": True,
                    "is_new_low": False,
                    "strength_state": "new_high",
                    "strength_score": 2,
                    "updated_at": "2026-04-09T13:45:00+08:00",
                }
            }
        ),
    )

    payload = serving_store.fetch_spot_latest_list()
    assert "ts" in payload
    assert payload["market_strength_score"] == 2.0
    assert payload["market_strength_pct"] == 100.0
    assert payload["market_strength_count"] == 1
    assert payload["market_strength_breakdown"] == {
        "new_high": 1,
        "strong_up": 0,
        "flat": 0,
        "strong_down": 0,
        "new_low": 0,
    }
    assert payload["items"] == [
        {
            "symbol": "2330",
            "open": 610.0,
            "high": 620.0,
            "low": 600.0,
            "close": 612.0,
            "last_price": 612.0,
            "session_high": 620.0,
            "session_low": 600.0,
            "reference_price": 607.0,
            "price_chg": 5.0,
            "pct_chg": 0.82,
            "gap_value": 3.0,
            "gap_pct": 0.4942339373970346,
            "is_gap_up": True,
            "is_gap_down": False,
            "is_new_high": True,
            "is_new_low": False,
            "strength_state": "new_high",
            "strength_score": 2,
            "updated_at": 1775713500000,
        },
        {
            "symbol": "2317",
            "open": None,
            "high": None,
            "low": None,
            "close": None,
            "last_price": None,
            "session_high": None,
            "session_low": None,
            "reference_price": None,
            "price_chg": None,
            "pct_chg": None,
            "gap_value": None,
            "gap_pct": None,
            "is_gap_up": None,
            "is_gap_down": None,
            "is_new_high": None,
            "is_new_low": None,
            "strength_state": None,
            "strength_score": None,
            "updated_at": None,
        },
    ]


def test_fetch_spot_market_distribution_latest_and_series(monkeypatch) -> None:
    monkeypatch.setattr(
        serving_store,
        "get_serving_redis_client",
        lambda: _FakeRedisSpotDistribution(
            {
                "ts": 1775713500000,
                "up_count": 5,
                "down_count": 3,
                "flat_count": 2,
                "total_count": 10,
                "trend_index": 0.2,
                "bucket_width_pct": 1,
                "distribution_buckets": [
                    {"label": "-1%~0%", "lower_pct": -1, "upper_pct": 0, "count": 3},
                    {"label": "0%~1%", "lower_pct": 0, "upper_pct": 1, "count": 2},
                    {"label": "1%~2%", "lower_pct": 1, "upper_pct": 2, "count": 5},
                ],
            },
            [
                {
                    "ts": 1775713200000,
                    "up_count": 4,
                    "down_count": 3,
                    "flat_count": 3,
                    "total_count": 10,
                    "trend_index": 0.1,
                },
                {
                    "ts": 1775713500000,
                    "up_count": 5,
                    "down_count": 3,
                    "flat_count": 2,
                    "total_count": 10,
                    "trend_index": 0.2,
                },
            ],
        ),
    )

    latest = serving_store.fetch_spot_market_distribution_latest()
    series = serving_store.fetch_spot_market_distribution_today_range()
    assert latest is not None
    assert latest["up_count"] == 5
    assert latest["down_count"] == 3
    assert latest["trend_index"] == 0.2
    assert len(latest["distribution_buckets"]) == 3
    assert series[0]["trend_index"] == 0.1
    assert series[1]["up_count"] == 5


def test_load_spot_symbols_sanitizes_invalid_and_duplicate_entries(monkeypatch, tmp_path) -> None:
    symbols_file = tmp_path / "symbols.txt"
    symbols_file.write_text("2330\nBAD\n2317\n2330\n", encoding="utf-8")
    monkeypatch.setattr(serving_store, "INGESTOR_SPOT_SYMBOLS_FILE", str(symbols_file))
    monkeypatch.setattr(serving_store, "_SPOT_SYMBOLS_CACHE", {"symbols": None, "ts": 0.0})

    assert serving_store._load_spot_symbols() == ["2330", "2317"]
