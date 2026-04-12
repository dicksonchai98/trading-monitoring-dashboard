from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient


def _register_and_login(
    client: TestClient,
    username: str = "quote-user@example.com",
    password: str = "quote-pass",
) -> dict[str, str]:
    send_res = client.post("/auth/email/send-otp", json={"email": username})
    assert send_res.status_code == 202
    verify_res = client.post(
        "/auth/email/verify-otp", json={"email": username, "otp_code": "123456"}
    )
    assert verify_res.status_code == 200
    register_res = client.post(
        "/auth/register",
        json={
            "username": username,
            "password": password,
            "verification_token": verify_res.json()["verification_token"],
        },
    )
    assert register_res.status_code == 200
    login_res = client.post("/auth/login", json={"username": username, "password": password})
    assert login_res.status_code == 200
    return {"access_token": login_res.json()["access_token"]}


def test_quote_latest_requires_auth() -> None:
    client = TestClient(app)
    response = client.get("/v1/quote/latest")
    assert response.status_code == 401


def test_quote_latest_returns_data_when_available(monkeypatch) -> None:
    client = TestClient(app)
    auth = _register_and_login(client, username="quote-latest@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    monkeypatch.setattr(
        "app.routes.serving.fetch_quote_latest",
        lambda _code: {
            "code": "TXFC6",
            "main_chip": 1.0,
            "event_ts": "2026-04-05T09:30:00+08:00",
        },
    )
    response = client.get("/v1/quote/latest", headers=headers)
    assert response.status_code == 200
    assert response.json()["code"] == "TXFC6"


def test_quote_history_requires_range() -> None:
    client = TestClient(app)
    auth = _register_and_login(client, username="quote-history@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    response = client.get("/v1/quote/history", headers=headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "missing_range"


def test_quote_aggregates_returns_payload(monkeypatch) -> None:
    client = TestClient(app)
    auth = _register_and_login(client, username="quote-agg@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    monkeypatch.setattr(
        "app.routes.serving.fetch_quote_aggregates",
        lambda _session, _code, _time_range: {
            "code": "TXFC6",
            "count": 1,
            "main_chip": {"min": 1.0, "max": 1.0, "avg": 1.0, "last": 1.0},
            "long_short_force": {"min": 2.0, "max": 2.0, "avg": 2.0, "last": 2.0},
        },
    )
    response = client.get(
        "/v1/quote/aggregates?from_ms=1712275200000&to_ms=1712275260000",
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["count"] == 1


def test_serving_sse_emits_quote_latest_event(monkeypatch) -> None:
    client = TestClient(app)
    auth = _register_and_login(client, username="quote-sse@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    monkeypatch.setattr("app.routes.serving.fetch_current_kbar", lambda _code: None)
    monkeypatch.setattr("app.routes.serving.fetch_metric_latest", lambda _code: None)
    calls = {"count": 0}

    def _quote_latest(_code):  # type: ignore[no-untyped-def]
        calls["count"] += 1
        if calls["count"] == 1:
            return {
                "code": "TXFC6",
                "event_ts": "2026-04-05T09:30:00+08:00",
                "main_chip": 1.0,
            }
        raise RuntimeError("stop stream")

    monkeypatch.setattr("app.routes.serving.fetch_quote_latest", _quote_latest)

    with client.stream("GET", "/v1/stream/sse", headers=headers) as response:
        assert response.status_code == 200
        chunks: list[str] = []
        for line in response.iter_lines():
            if line:
                chunks.append(line)
        assert chunks
        assert any("event: quote_latest" in item for item in chunks)
