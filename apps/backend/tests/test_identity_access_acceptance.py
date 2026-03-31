from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient


def _register_and_login(
    client: TestClient, username: str = "alice@example.com", password: str = "alice-pass"
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
    return {
        "access_token": login_res.json()["access_token"],
        "set_cookie": login_res.headers.get("set-cookie", ""),
    }


def test_register_and_login_return_access_and_secure_refresh_cookie() -> None:
    client = TestClient(app)
    send_res = client.post("/auth/email/send-otp", json={"email": "user1@example.com"})
    assert send_res.status_code == 202
    verify_res = client.post(
        "/auth/email/verify-otp",
        json={"email": "user1@example.com", "otp_code": "123456"},
    )
    register_res = client.post(
        "/auth/register",
        json={
            "username": "user1@example.com",
            "password": "pass1",
            "verification_token": verify_res.json()["verification_token"],
        },
    )
    assert register_res.status_code == 200
    assert "access_token" in register_res.json()
    cookie = register_res.headers.get("set-cookie", "")
    assert "refresh_token=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=strict" in cookie
    assert "Secure" in cookie

    login_res = client.post(
        "/auth/login",
        json={"username": "user1@example.com", "password": "pass1"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


def test_register_email_requires_verification_token() -> None:
    client = TestClient(app)
    res = client.post(
        "/auth/register",
        json={"username": "email-user@example.com", "password": "pass1"},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "verification_required"


def test_refresh_rotation_reuse_old_token_fails_with_401() -> None:
    client = TestClient(app)
    auth = _register_and_login(client, username="user2@example.com", password="pass2")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    current_refresh = auth["set_cookie"].split(";", 1)[0].split("=", 1)[1]

    first_refresh = client.post(
        "/auth/refresh", headers=headers, cookies={"refresh_token": current_refresh}
    )
    assert first_refresh.status_code == 200
    old_cookie = auth["set_cookie"].split(";", 1)[0]
    rotated_cookie = first_refresh.headers.get("set-cookie", "").split(";", 1)[0].split("=", 1)[1]
    second_refresh = client.post(
        "/auth/refresh", headers=headers, cookies={"refresh_token": rotated_cookie}
    )
    assert second_refresh.status_code == 200

    # Reuse the old refresh cookie should fail due to denylist jti.
    replay = client.post(
        "/auth/refresh",
        headers=headers,
        cookies={"refresh_token": old_cookie.split("=", 1)[1]},
    )
    assert replay.status_code == 401


def test_logout_revokes_refresh_cookie_token() -> None:
    client = TestClient(app)
    auth = _register_and_login(client, username="logout@example.com", password="pass4")
    refresh_token = auth["set_cookie"].split(";", 1)[0].split("=", 1)[1]
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    logout_res = client.post("/auth/logout", cookies={"refresh_token": refresh_token})
    assert logout_res.status_code == 204
    cleared_cookie = logout_res.headers.get("set-cookie", "")
    assert "refresh_token=" in cleared_cookie
    assert "Max-Age=0" in cleared_cookie

    refresh_res = client.post(
        "/auth/refresh",
        headers=headers,
        cookies={"refresh_token": refresh_token},
    )
    assert refresh_res.status_code == 401


def test_logout_without_cookie_returns_204() -> None:
    client = TestClient(app)
    res = client.post("/auth/logout")
    assert res.status_code == 204


def test_public_routes_allow_anonymous_and_protected_routes_require_auth() -> None:
    client = TestClient(app)
    assert client.get("/billing/plans").status_code == 200
    assert client.get("/realtime/strength").status_code == 200

    assert client.post("/billing/checkout").status_code == 401
    assert client.get("/billing/status").status_code == 401
    assert client.get("/analytics/history").status_code == 401


def test_admin_routes_return_403_for_non_admin_user() -> None:
    client = TestClient(app)
    auth = _register_and_login(client, username="user3@example.com", password="pass3")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    res = client.get("/api/admin/logs", headers=headers)
    assert res.status_code == 403


def test_protected_sse_endpoint_rejects_unauthorized() -> None:
    client = TestClient(app)
    res = client.get("/realtime/weighted")
    assert res.status_code == 401


def test_protected_routes_expose_http_bearer_security_in_openapi() -> None:
    client = TestClient(app)
    schema = client.get("/openapi.json").json()
    operation = schema["paths"]["/billing/status"]["get"]
    assert operation.get("security") == [{"HTTPBearer": []}]


def test_serving_health_route_is_available() -> None:
    client = TestClient(app)
    response = client.get("/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
