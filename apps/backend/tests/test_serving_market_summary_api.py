from __future__ import annotations

import asyncio
import json
import uuid
from types import SimpleNamespace

import pytest
from app.main import app
from app.routes.serving import _payload_signature, stream_sse
from app.state import serving_rate_limiter
from fastapi.testclient import TestClient


def _auth_headers(client: TestClient) -> dict[str, str]:
    email = f"market-summary-{uuid.uuid4().hex[:8]}@example.com"
    login_secret = "Pass-1234"  # noqa: S105 - test credential only
    send_res = client.post("/auth/email/send-otp", json={"email": email})
    assert send_res.status_code == 202
    verify_res = client.post("/auth/email/verify-otp", json={"email": email, "otp_code": "123456"})
    assert verify_res.status_code == 200
    register_res = client.post(
        "/auth/register",
        json={
            "user_id": email,
            "email": email,
            "password": login_secret,
            "verification_token": verify_res.json()["verification_token"],
        },
    )
    assert register_res.status_code == 200
    login_res = client.post("/auth/login", json={"user_id": email, "password": login_secret})
    assert login_res.status_code == 200
    return {"Authorization": f"Bearer {login_res.json()['access_token']}"}


def test_payload_signature_ignores_mapping_key_order_but_detects_value_changes() -> None:
    left = {
        "index_code": "TSE001",
        "trade_date": "2026-04-10",
        "top": [{"rank_no": 1, "symbol": "2330", "contribution_points": 3.19}],
        "bottom": [{"rank_no": 1, "symbol": "2881", "contribution_points": -0.82}],
    }
    right = {
        "trade_date": "2026-04-10",
        "bottom": [{"symbol": "2881", "contribution_points": -0.82, "rank_no": 1}],
        "top": [{"symbol": "2330", "contribution_points": 3.19, "rank_no": 1}],
        "index_code": "TSE001",
    }
    changed = {
        "trade_date": "2026-04-10",
        "bottom": [{"symbol": "2881", "contribution_points": -0.83, "rank_no": 1}],
        "top": [{"symbol": "2330", "contribution_points": 3.19, "rank_no": 1}],
        "index_code": "TSE001",
    }

    assert _payload_signature(left) == _payload_signature(right)
    assert _payload_signature(left) != _payload_signature(changed)


def test_market_summary_latest_route_returns_payload(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)

    monkeypatch.setattr(
        "app.routes.serving.fetch_market_summary_latest",
        lambda _code: {
            "code": "TSE001",
            "event_ts": 1712368801000,
            "completion_ratio": 0.5,
            "estimated_turnover": 100.0,
        },
    )

    response = client.get("/v1/market-summary/latest", headers=headers)
    assert response.status_code == 200
    assert response.json()["code"] == "TSE001"


def test_market_summary_today_route_returns_list(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)

    monkeypatch.setattr(
        "app.routes.serving.fetch_market_summary_today_range",
        lambda _code, _time_range: [{"code": "TSE001", "minute_ts": 1712368800000}],
    )

    response = client.get("/v1/market-summary/today", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_otc_summary_latest_route_returns_payload(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)

    monkeypatch.setattr(
        "app.routes.serving.fetch_otc_summary_latest",
        lambda _code: {
            "code": "OTC001",
            "event_ts": 1712368801000,
            "minute_ts": 1712368800000,
            "index_value": 252.34,
        },
    )

    response = client.get("/v1/otc-summary/latest", headers=headers)
    assert response.status_code == 200
    assert response.json()["code"] == "OTC001"


def test_otc_summary_today_route_returns_list(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)

    monkeypatch.setattr(
        "app.routes.serving.fetch_otc_summary_today_range",
        lambda _code, _time_range: [{"code": "OTC001", "minute_ts": 1712368800000}],
    )

    response = client.get("/v1/otc-summary/today", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_market_summary_history_route_requires_range() -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    response = client.get("/v1/market-summary/history", headers=headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "missing_range"


def test_market_summary_latest_returns_503_when_redis_unavailable(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    monkeypatch.setattr(
        "app.routes.serving.fetch_market_summary_latest",
        lambda _code: (_ for _ in ()).throw(RuntimeError("redis down")),
    )
    response = client.get("/v1/market-summary/latest", headers=headers)
    assert response.status_code == 503
    assert response.json()["detail"] == "redis_unavailable"


def test_otc_summary_latest_returns_404_when_missing(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    monkeypatch.setattr("app.routes.serving.fetch_otc_summary_latest", lambda _code: None)
    response = client.get("/v1/otc-summary/latest", headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "otc_summary_not_found"


def test_otc_summary_latest_returns_503_when_redis_unavailable(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    monkeypatch.setattr(
        "app.routes.serving.fetch_otc_summary_latest",
        lambda _code: (_ for _ in ()).throw(RuntimeError("redis down")),
    )
    response = client.get("/v1/otc-summary/latest", headers=headers)
    assert response.status_code == 503
    assert response.json()["detail"] == "redis_unavailable"


def test_market_summary_history_returns_503_when_db_unavailable(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    monkeypatch.setattr(
        "app.routes.serving.fetch_market_summary_history",
        lambda _session, _code, _range: (_ for _ in ()).throw(RuntimeError("db down")),
    )
    response = client.get(
        "/v1/market-summary/history",
        headers=headers,
        params={"from_ms": 1712368800000, "to_ms": 1712368860000},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "db_unavailable"


def test_spot_latest_route_returns_payload(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    monkeypatch.setattr(
        "app.routes.serving.fetch_spot_latest",
        lambda _symbol: {
            "symbol": "2330",
            "last_price": 612.0,
            "session_high": 620.0,
            "session_low": 600.0,
            "updated_at": 1712368801000,
        },
    )
    response = client.get("/v1/spot/latest", headers=headers, params={"symbol": "2330"})
    assert response.status_code == 200
    assert response.json()["symbol"] == "2330"


def test_spot_latest_route_returns_404_when_missing(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    monkeypatch.setattr("app.routes.serving.fetch_spot_latest", lambda _symbol: None)
    response = client.get("/v1/spot/latest", headers=headers, params={"symbol": "2330"})
    assert response.status_code == 404
    assert response.json()["detail"] == "spot_not_found"


def test_spot_market_distribution_latest_route_returns_payload(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    monkeypatch.setattr(
        "app.routes.serving.fetch_spot_market_distribution_latest",
        lambda: {
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
    )

    response = client.get("/v1/spot/market-distribution/latest", headers=headers)
    assert response.status_code == 200
    assert response.json()["total_count"] == 10


def test_spot_market_distribution_today_route_returns_list(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    monkeypatch.setattr(
        "app.routes.serving.fetch_spot_market_distribution_today_range",
        lambda _time_range: [
            {
                "ts": 1775713200000,
                "up_count": 4,
                "down_count": 3,
                "flat_count": 3,
                "total_count": 10,
                "trend_index": 0.1,
            }
        ],
    )

    response = client.get("/v1/spot/market-distribution/today", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


class _FakeSSERequest:
    def __init__(self, host: str, disconnect_after_checks: int) -> None:
        self.headers: dict[str, str] = {}
        self.client = SimpleNamespace(host=host)
        self.url = SimpleNamespace(path="/v1/stream/sse")
        self._checks = 0
        self._disconnect_after_checks = disconnect_after_checks

    async def is_disconnected(self) -> bool:
        self._checks += 1
        return self._checks > self._disconnect_after_checks


def test_sse_disconnect_isolated_per_connection(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.routes.serving.fetch_current_kbar",
        lambda _code: {"code": "TSE001", "minute_ts": 1712368800000},
    )
    monkeypatch.setattr("app.routes.serving.fetch_metric_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_index_contrib_ranking_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_index_contrib_sector_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_market_summary_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_otc_summary_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_spot_latest_list", lambda: {"ts": 1, "items": []})
    monkeypatch.setattr("app.routes.serving.SERVING_HEARTBEAT_SECONDS", 3600)

    async def _run() -> None:
        req_drop = _FakeSSERequest(host="10.0.0.1", disconnect_after_checks=1)
        req_alive = _FakeSSERequest(host="10.0.0.2", disconnect_after_checks=100)
        response_drop = await stream_sse(req_drop, code="TSE001")
        response_alive = await stream_sse(req_alive, code="TSE001")
        drop_iter = response_drop.body_iterator
        alive_iter = response_alive.body_iterator

        await alive_iter.__anext__()
        assert serving_rate_limiter._sse_active.get("10.0.0.2") == 1

        await drop_iter.__anext__()
        with pytest.raises(StopAsyncIteration):
            while True:
                await drop_iter.__anext__()
        assert "10.0.0.1" not in serving_rate_limiter._sse_active
        assert serving_rate_limiter._sse_active.get("10.0.0.2") == 1

        await alive_iter.aclose()

    asyncio.run(_run())


def test_sse_includes_spot_latest_list_event(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routes.serving.fetch_current_kbar", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_metric_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_index_contrib_ranking_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_index_contrib_sector_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_market_summary_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_otc_summary_latest", lambda _code: None)
    monkeypatch.setattr(
        "app.routes.serving.fetch_spot_latest_list",
        lambda: {
            "ts": 1712368801000,
            "items": [
                {
                    "symbol": "2330",
                    "last_price": 612.0,
                    "session_high": 620.0,
                    "session_low": 600.0,
                    "updated_at": 1712368801000,
                }
            ],
        },
    )
    monkeypatch.setattr("app.routes.serving.SERVING_HEARTBEAT_SECONDS", 3600)

    async def _run() -> None:
        req = _FakeSSERequest(host="10.0.0.3", disconnect_after_checks=10)
        response = await stream_sse(req, code="TSE001")
        event_bytes = await response.body_iterator.__anext__()
        event_text = event_bytes.decode("utf-8")
        assert "event: spot_latest_list" in event_text
        assert '"symbol": "2330"' in event_text
        await response.body_iterator.aclose()

    asyncio.run(_run())


def test_sse_keeps_other_events_alive_when_spot_latest_list_fetch_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.routes.serving.fetch_current_kbar",
        lambda _code: {"code": "TSE001", "minute_ts": 1712368800000},
    )
    monkeypatch.setattr("app.routes.serving.fetch_metric_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_index_contrib_ranking_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_index_contrib_sector_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_market_summary_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_otc_summary_latest", lambda _code: None)
    monkeypatch.setattr(
        "app.routes.serving.fetch_spot_latest_list",
        lambda: (_ for _ in ()).throw(ValueError("invalid spot symbol")),
    )
    monkeypatch.setattr("app.routes.serving.SERVING_HEARTBEAT_SECONDS", 3600)

    async def _run() -> None:
        req = _FakeSSERequest(host="10.0.0.5", disconnect_after_checks=10)
        response = await stream_sse(req, code="TSE001")
        event_bytes = await response.body_iterator.__anext__()
        event_text = event_bytes.decode("utf-8")
        assert "event: kbar_current" in event_text
        await response.body_iterator.aclose()

    asyncio.run(_run())


def test_sse_includes_otc_summary_latest_event(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routes.serving.fetch_current_kbar", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_metric_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_index_contrib_ranking_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_index_contrib_sector_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_market_summary_latest", lambda _code: None)
    monkeypatch.setattr(
        "app.routes.serving.fetch_otc_summary_latest",
        lambda _code: {
            "code": "OTC001",
            "minute_ts": 1712368800000,
            "event_ts": 1712368801000,
            "index_value": 252.34,
        },
    )
    monkeypatch.setattr("app.routes.serving.fetch_spot_latest_list", lambda: {"ts": 1, "items": []})
    monkeypatch.setattr("app.routes.serving.SERVING_HEARTBEAT_SECONDS", 3600)

    async def _run() -> None:
        req = _FakeSSERequest(host="10.0.0.4", disconnect_after_checks=10)
        response = await stream_sse(req, code="TSE001")
        first_event = await response.body_iterator.__anext__()
        second_event = await response.body_iterator.__anext__()
        merged = (first_event + second_event).decode("utf-8")
        assert "event: otc_summary_latest" in merged
        assert '"code": "OTC001"' in merged
        await response.body_iterator.aclose()

    asyncio.run(_run())


def test_sse_includes_index_contrib_events_with_epoch_ts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routes.serving.fetch_current_kbar", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_metric_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_market_summary_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_otc_summary_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_quote_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_spot_latest_list", lambda: None)
    monkeypatch.setattr("app.routes.serving.fetch_spot_market_distribution_latest", lambda: None)
    monkeypatch.setattr(
        "app.routes.serving.fetch_index_contrib_ranking_latest",
        lambda _index_code: {
            "index_code": "TSE001",
            "trade_date": "2026-04-10",
            "top": [{"rank_no": 1, "symbol": "2330", "contribution_points": 3.19}],
            "bottom": [{"rank_no": 1, "symbol": "2881", "contribution_points": -0.82}],
        },
    )
    monkeypatch.setattr(
        "app.routes.serving.fetch_index_contrib_sector_latest",
        lambda _index_code: {
            "index_code": "TSE001",
            "trade_date": "2026-04-10",
            "sectors": [
                {
                    "name": "Semiconductor",
                    "children": [
                        {"name": "2330", "size": 12, "contribution_points": 4.3},
                    ],
                }
            ],
        },
    )
    monkeypatch.setattr("app.routes.serving.SERVING_HEARTBEAT_SECONDS", 3600)

    async def _run() -> None:
        req = _FakeSSERequest(host="10.0.0.7", disconnect_after_checks=10)
        response = await stream_sse(req, code="TSE001")
        ranking_event = await response.body_iterator.__anext__()
        sector_event = await response.body_iterator.__anext__()

        ranking_text = ranking_event.decode("utf-8")
        sector_text = sector_event.decode("utf-8")
        assert "event: index_contrib_ranking" in ranking_text
        assert "event: index_contrib_sector" in sector_text

        ranking_data_line = next(
            line for line in ranking_text.splitlines() if line.startswith("data: ")
        )
        sector_data_line = next(
            line for line in sector_text.splitlines() if line.startswith("data: ")
        )
        ranking_payload = json.loads(ranking_data_line.removeprefix("data: ").strip())
        sector_payload = json.loads(sector_data_line.removeprefix("data: ").strip())
        assert ranking_payload["ts"] > 1_000_000_000_000
        assert sector_payload["ts"] > 1_000_000_000_000
        await response.body_iterator.aclose()

    asyncio.run(_run())
