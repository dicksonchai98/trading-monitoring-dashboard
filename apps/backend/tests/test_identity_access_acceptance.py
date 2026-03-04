from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient


def _register_and_login(
    client: TestClient, username: str = "alice", password: str = "alice-pass"
) -> dict[str, str]:
    register_res = client.post("/auth/register", json={"username": username, "password": password})
    assert register_res.status_code == 200
    login_res = client.post("/auth/login", json={"username": username, "password": password})
    assert login_res.status_code == 200
    return {
        "access_token": login_res.json()["access_token"],
        "set_cookie": login_res.headers.get("set-cookie", ""),
    }


def test_register_and_login_return_access_and_secure_refresh_cookie() -> None:
    client = TestClient(app)
    register_res = client.post("/auth/register", json={"username": "user1", "password": "pass1"})
    assert register_res.status_code == 200
    assert "access_token" in register_res.json()
    cookie = register_res.headers.get("set-cookie", "")
    assert "refresh_token=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=strict" in cookie
    assert "Secure" in cookie

    login_res = client.post("/auth/login", json={"username": "user1", "password": "pass1"})
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


def test_refresh_rotation_reuse_old_token_fails_with_401() -> None:
    client = TestClient(app)
    auth = _register_and_login(client, username="user2", password="pass2")
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


def test_public_routes_allow_anonymous_and_protected_routes_require_auth() -> None:
    client = TestClient(app)
    assert client.get("/billing/plans").status_code == 200
    assert client.get("/realtime/strength").status_code == 200

    assert client.post("/billing/checkout").status_code == 401
    assert client.get("/billing/status").status_code == 401
    assert client.get("/analytics/history").status_code == 401


def test_admin_routes_return_403_for_non_admin_user() -> None:
    client = TestClient(app)
    auth = _register_and_login(client, username="user3", password="pass3")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    res = client.get("/admin/logs", headers=headers)
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
