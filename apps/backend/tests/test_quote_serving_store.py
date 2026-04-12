from __future__ import annotations

import json
from datetime import datetime

from app.db.session import SessionLocal
from app.models.quote_feature_1m import QuoteFeature1mModel
from app.services.serving_store import (
    TimeRange,
    fetch_quote_aggregates,
    fetch_quote_history,
    fetch_quote_latest,
    fetch_quote_today_range,
)


class _FakeRedis:
    def __init__(self) -> None:
        self.latest = {}
        self.series = {}

    def get(self, key):  # type: ignore[no-untyped-def]
        return self.latest.get(key)

    def zrangebyscore(self, key, start, end):  # type: ignore[no-untyped-def]
        rows = self.series.get(key, [])
        return [member for score, member in rows if start <= score <= end]


def test_fetch_quote_latest_and_today_range(monkeypatch) -> None:
    redis = _FakeRedis()
    trade_date = "2026-04-04"
    latest_key = f"dev:state:TXFC6:{trade_date}:quote_features:latest"
    zset_key = f"dev:state:TXFC6:{trade_date}:quote_features:zset"
    latest_payload = {
        "code": "TXFC6",
        "event_ts": "2026-04-05T09:30:01+08:00",
        "main_chip": 3,
        "long_short_force": 4,
    }
    redis.latest[latest_key] = json.dumps(latest_payload)
    redis.series[zset_key] = [
        (
            int(datetime.fromisoformat("2026-04-05T09:30:01+08:00").timestamp()),
            json.dumps(latest_payload),
        )
    ]
    monkeypatch.setattr("app.services.serving_store.get_serving_redis_client", lambda: redis)
    monkeypatch.setattr(
        "app.services.serving_store.trade_date_for",
        lambda _ts: datetime.fromisoformat("2026-04-04T00:00:00+08:00").date(),
    )
    latest = fetch_quote_latest("TXFC6")
    assert latest is not None
    assert latest["code"] == "TXFC6"
    time_range = TimeRange(
        start=datetime.fromisoformat("2026-04-05T09:30:00+08:00"),
        end=datetime.fromisoformat("2026-04-05T09:31:00+08:00"),
    )
    rows = fetch_quote_today_range("TXFC6", time_range)
    assert len(rows) == 1


def test_fetch_quote_history_and_aggregates() -> None:
    with SessionLocal() as session:
        session.add(
            QuoteFeature1mModel(
                code="TXFC6",
                trade_date=datetime.fromisoformat("2026-04-04T00:00:00+08:00").date(),
                minute_ts=datetime.fromisoformat("2026-04-05T09:30:00+08:00"),
                main_chip=1.0,
                main_chip_day_high=1.0,
                main_chip_day_low=1.0,
                main_chip_strength=0.5,
                long_short_force=2.0,
                long_short_force_day_high=2.0,
                long_short_force_day_low=2.0,
                long_short_force_strength=0.5,
                payload="{}",
            )
        )
        session.commit()
        time_range = TimeRange(
            start=datetime.fromisoformat("2026-04-05T09:00:00+08:00"),
            end=datetime.fromisoformat("2026-04-05T10:00:00+08:00"),
        )
        history = fetch_quote_history(session, "TXFC6", time_range)
        assert len(history) == 1
        agg = fetch_quote_aggregates(session, "TXFC6", time_range)
        assert agg["count"] == 1
        assert agg["main_chip"]["last"] == 1.0
