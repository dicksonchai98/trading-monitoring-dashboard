from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient


def _auth_headers(client: TestClient) -> dict[str, str]:
    email = "serving-quote@example.com"
    password = "pass1"  # noqa: S105 - test credential only
    send_res = client.post("/auth/email/send-otp", json={"email": email})
    assert send_res.status_code == 202
    verify_res = client.post("/auth/email/verify-otp", json={"email": email, "otp_code": "123456"})
    assert verify_res.status_code == 200
    register_res = client.post(
        "/auth/register",
        json={
            "username": email,
            "password": password,
            "verification_token": verify_res.json()["verification_token"],
        },
    )
    assert register_res.status_code == 200
    login_res = client.post("/auth/login", json={"username": email, "password": password})
    assert login_res.status_code == 200
    return {"Authorization": f"Bearer {login_res.json()['access_token']}"}


def test_kbar_today_requires_code() -> None:
    client = TestClient(app)
    headers = _auth_headers(client)

    response = client.get("/v1/kbar/1m/today", headers=headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "missing_code"


def test_bidask_today_requires_code() -> None:
    client = TestClient(app)
    headers = _auth_headers(client)

    response = client.get("/v1/metric/bidask/today", headers=headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "missing_code"


def test_kbar_today_returns_404_when_code_has_no_data(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    monkeypatch.setattr("app.routes.serving.fetch_kbar_today_range", lambda _code, _range: [])

    response = client.get("/v1/kbar/1m/today", headers=headers, params={"code": "TXFD6"})

    assert response.status_code == 404
    assert response.json()["detail"] == "kbar_not_found"


def test_bidask_today_returns_404_when_code_has_no_data(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    monkeypatch.setattr("app.routes.serving.fetch_metric_today_range", lambda _code, _range: [])

    response = client.get("/v1/metric/bidask/today", headers=headers, params={"code": "TXFD6"})

    assert response.status_code == 404
    assert response.json()["detail"] == "metric_not_found"


def test_kbar_daily_amplitude_requires_code() -> None:
    client = TestClient(app)
    headers = _auth_headers(client)

    response = client.get("/v1/kbar/1m/daily-amplitude", headers=headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "missing_code"


def test_kbar_daily_amplitude_requires_positive_days() -> None:
    client = TestClient(app)
    headers = _auth_headers(client)

    response = client.get(
        "/v1/kbar/1m/daily-amplitude", headers=headers, params={"code": "TXFD6", "n": 0}
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "invalid_days"


def test_kbar_daily_amplitude_returns_daily_rows(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    monkeypatch.setattr(
        "app.routes.serving.fetch_kbar_daily_amplitude",
        lambda _session, _code, _days: [
            {
                "code": "TXFD6",
                "trade_date": "2026-04-08",
                "open": 34810.0,
                "high": 34980.0,
                "low": 34780.0,
                "close": 34920.0,
                "day_amplitude": 200.0,
            }
        ],
    )

    response = client.get(
        "/v1/kbar/1m/daily-amplitude", headers=headers, params={"code": "TXFD6", "n": 5}
    )

    assert response.status_code == 200
    assert response.json()[0]["trade_date"] == "2026-04-08"
    assert response.json()[0]["open"] == 34810.0
    assert response.json()[0]["high"] == 34980.0
    assert response.json()[0]["low"] == 34780.0
    assert response.json()[0]["close"] == 34920.0
    assert response.json()[0]["day_amplitude"] == 200.0


def test_kbar_daily_amplitude_returns_404_when_no_data(monkeypatch) -> None:
    client = TestClient(app)
    headers = _auth_headers(client)
    monkeypatch.setattr(
        "app.routes.serving.fetch_kbar_daily_amplitude",
        lambda _session, _code, _days: [],
    )

    response = client.get(
        "/v1/kbar/1m/daily-amplitude", headers=headers, params={"code": "TXFD6", "n": 5}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "kbar_not_found"
