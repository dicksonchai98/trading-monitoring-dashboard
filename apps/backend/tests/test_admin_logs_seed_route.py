from __future__ import annotations

from app.db.session import SessionLocal
from app.main import app
from app.repositories.user_repository import UserRepository
from app.security.passwords import hash_password
from app.state import audit_log
from fastapi.testclient import TestClient


def _create_admin(username: str = "seed-admin@example.com", password: str = "seed-pass") -> None:
    repo = UserRepository(session_factory=SessionLocal)
    repo.create_user(username=username, password_hash=hash_password(password), role="admin")


def _login(client: TestClient, username: str, password: str) -> str:
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_seed_admin_logs_inserts_events_and_returns_total() -> None:
    client = TestClient(app)
    audit_log.events.clear()
    _create_admin()
    token = _login(client, "seed-admin@example.com", "seed-pass")

    response = client.post(
        "/api/admin/logs/seed",
        headers={"Authorization": f"Bearer {token}"},
        json={"count": 4, "clear_before": True},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["seeded"] == 4
    assert body["total"] == 4

    logs_response = client.get("/api/admin/logs", headers={"Authorization": f"Bearer {token}"})
    assert logs_response.status_code == 200
    events = logs_response.json()["events"]
    assert len(events) == 4
    assert any(item["event_type"] == "crawler_run_triggered" for item in events)
