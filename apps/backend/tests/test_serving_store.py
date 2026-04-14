from __future__ import annotations

import json

from app.services import serving_store


class _FakeRedis:
    def __init__(self) -> None:
        self.zsets: dict[str, dict[str, float]] = {}
        self.strings: dict[str, str] = {}

    def zrevrange(self, key: str, start: int, end: int, withscores: bool = False):
        members = sorted(
            self.zsets.get(key, {}).items(),
            key=lambda item: (-float(item[1]), str(item[0])),
        )
        sliced = members[start : end + 1 if end >= 0 else None]
        if withscores:
            return list(sliced)
        return [member for member, _score in sliced]

    def zrange(self, key: str, start: int, end: int, withscores: bool = False):
        members = sorted(
            self.zsets.get(key, {}).items(),
            key=lambda item: (float(item[1]), str(item[0])),
        )
        sliced = members[start : end + 1 if end >= 0 else None]
        if withscores:
            return list(sliced)
        return [member for member, _score in sliced]

    def get(self, key: str):
        return self.strings.get(key)


def test_fetch_index_contrib_ranking_latest_from_zsets(monkeypatch) -> None:
    redis = _FakeRedis()
    trade_date = serving_store.trade_date_for(
        serving_store.datetime.now(tz=serving_store.TZ_TAIPEI)
    )
    top_key = (
        f"{serving_store.SERVING_ENV}:state:index_contrib:"
        f"TSE001:{trade_date.isoformat()}:ranking:top"
    )
    bottom_key = (
        f"{serving_store.SERVING_ENV}:state:index_contrib:"
        f"TSE001:{trade_date.isoformat()}:ranking:bottom"
    )
    redis.zsets[top_key] = {"2330": 3.19, "2317": 1.21}
    redis.zsets[bottom_key] = {"2881": -0.82, "6505": -0.1}
    monkeypatch.setattr(serving_store, "get_serving_redis_client", lambda: redis)

    result = serving_store.fetch_index_contrib_ranking_latest("TSE001")

    assert result is not None
    assert result["index_code"] == "TSE001"
    assert result["top"][0]["symbol"] == "2330"
    assert result["bottom"][0]["symbol"] == "2881"


def test_fetch_index_contrib_sector_latest_from_json(monkeypatch) -> None:
    redis = _FakeRedis()
    trade_date = serving_store.trade_date_for(
        serving_store.datetime.now(tz=serving_store.TZ_TAIPEI)
    )
    key = f"{serving_store.SERVING_ENV}:state:index_contrib:TSE001:{trade_date.isoformat()}:sector"
    redis.strings[key] = json.dumps({"Semiconductor": 4.3, "Finance": -1.2})
    monkeypatch.setattr(serving_store, "get_serving_redis_client", lambda: redis)

    result = serving_store.fetch_index_contrib_sector_latest("TSE001")

    assert result is not None
    assert result["index_code"] == "TSE001"
    assert result["sectors"]["Semiconductor"] == 4.3
