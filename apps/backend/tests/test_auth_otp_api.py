from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient


def test_send_otp_returns_202_accepted() -> None:
    client = TestClient(app)
    res = client.post("/auth/email/send-otp", json={"email": "new@example.com"})
    assert res.status_code == 202
    assert res.json() == {"status": "accepted"}


def test_send_otp_cooldown_returns_retry_after_seconds() -> None:
    client = TestClient(app)
    first = client.post("/auth/email/send-otp", json={"email": "cooldown@example.com"})
    assert first.status_code == 202
    second = client.post("/auth/email/send-otp", json={"email": "cooldown@example.com"})
    assert second.status_code == 429
    assert second.json()["detail"]["reason"] in {"cooldown", "rate_limited"}
    assert second.json()["detail"]["retry_after_seconds"] >= 1


def test_register_requires_verification_token_for_email_username() -> None:
    client = TestClient(app)
    res = client.post(
        "/auth/register",
        json={"username": "new@example.com", "password": "pass1"},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "verification_required"
