from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from app.main import app
from app.routes.serving import stream_sse
from app.state import serving_rate_limiter
from fastapi.testclient import TestClient


def _auth_headers(client: TestClient) -> dict[str, str]:
    email = "market-summary@example.com"
    login_secret = "pass" + "1"
    send_res = client.post("/auth/email/send-otp", json={"email": email})
    assert send_res.status_code == 202
    verify_res = client.post("/auth/email/verify-otp", json={"email": email, "otp_code": "123456"})
    assert verify_res.status_code == 200
    register_res = client.post(
        "/auth/register",
        json={
            "username": email,
            "password": login_secret,
            "verification_token": verify_res.json()["verification_token"],
        },
    )
    assert register_res.status_code == 200
    login_res = client.post("/auth/login", json={"username": email, "password": login_secret})
    assert login_res.status_code == 200
    return {"Authorization": f"Bearer {login_res.json()['access_token']}"}


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
    monkeypatch.setattr("app.routes.serving.fetch_market_summary_latest", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.SERVING_HEARTBEAT_SECONDS", 3600)

    async def _run() -> None:
        req_drop = _FakeSSERequest(host="10.0.0.1", disconnect_after_checks=1)
        req_alive = _FakeSSERequest(host="10.0.0.2", disconnect_after_checks=100)
        response_drop = await stream_sse(req_drop)
        response_alive = await stream_sse(req_alive)
        drop_iter = response_drop.body_iterator
        alive_iter = response_alive.body_iterator

        await alive_iter.__anext__()
        assert serving_rate_limiter._sse_active.get("10.0.0.2") == 1

        await drop_iter.__anext__()
        with pytest.raises(StopAsyncIteration):
            await drop_iter.__anext__()
        assert "10.0.0.1" not in serving_rate_limiter._sse_active
        assert serving_rate_limiter._sse_active.get("10.0.0.2") == 1

        await alive_iter.aclose()

    asyncio.run(_run())
