from __future__ import annotations

import json
from datetime import datetime, timedelta

from app.services import serving_store
from app.services.serving_store import TimeRange
from zoneinfo import ZoneInfo

TZ_TAIPEI = ZoneInfo("Asia/Taipei")


class _FakeRedisLatest:
    def get(self, _key: str):
        return json.dumps(
            {
                "code": "OTC001",
                "trade_date": "2026-04-09",
                "minute_ts": "2026-04-09T13:01:00+08:00",
                "event_ts": "2026-04-09T13:01:23+08:00",
                "index_value": 252.34,
            },
            ensure_ascii=True,
        )


class _FakeRedisToday:
    def zrangebyscore(self, _key: str, _start: int, _end: int):
        return [
            json.dumps(
                {
                    "code": "OTC001",
                    "trade_date": "2026-04-09",
                    "minute_ts": "2026-04-09T13:00:00+08:00",
                    "event_ts": "2026-04-09T13:00:45+08:00",
                    "index_value": 251.91,
                },
                ensure_ascii=True,
            ),
            json.dumps(
                {
                    "code": "OTC001",
                    "trade_date": "2026-04-09",
                    "minute_ts": "2026-04-09T13:01:00+08:00",
                    "event_ts": "2026-04-09T13:01:23+08:00",
                    "index_value": 252.34,
                },
                ensure_ascii=True,
            ),
        ]


def test_fetch_otc_summary_latest_normalizes_epoch_ms(monkeypatch) -> None:
    monkeypatch.setattr(serving_store, "get_serving_redis_client", lambda: _FakeRedisLatest())

    payload = serving_store.fetch_otc_summary_latest("OTC001")

    assert payload is not None
    assert payload["code"] == "OTC001"
    assert payload["index_value"] == 252.34
    assert payload["minute_ts"] == 1775710860000
    assert payload["event_ts"] == 1775710883000


def test_fetch_otc_summary_today_range_returns_sorted_rows(monkeypatch) -> None:
    monkeypatch.setattr(serving_store, "get_serving_redis_client", lambda: _FakeRedisToday())
    end = datetime(2026, 4, 9, 13, 2, 0, tzinfo=TZ_TAIPEI)
    start = end - timedelta(minutes=5)
    result = serving_store.fetch_otc_summary_today_range("OTC001", TimeRange(start=start, end=end))

    assert len(result) == 2
    assert result[0]["minute_ts"] == 1775710800000
    assert result[1]["minute_ts"] == 1775710860000
    assert result[1]["index_value"] == 252.34
