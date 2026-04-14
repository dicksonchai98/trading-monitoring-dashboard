from __future__ import annotations

from app.db.session import SessionLocal
from app.main import app
from app.repositories.user_repository import UserRepository
from app.security.passwords import hash_password
from app.state import audit_event_repository, audit_log
from fastapi.testclient import TestClient


def _create_user(username: str, role: str, password: str = "pass-123") -> None:
    repo = UserRepository(session_factory=SessionLocal)
    repo.create_user(username=username, password_hash=hash_password(password), role=role)


def _login(client: TestClient, username: str, password: str = "pass-123") -> str:
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_admin_logs_returns_items_and_pagination() -> None:
    client = TestClient(app)
    audit_event_repository.delete_all()
    _create_user("admin-log@example.com", "admin")
    token = _login(client, "admin-log@example.com")

    audit_log.record(
        event_type="crawler_run_triggered",
        path="/api/admin/batch/crawler/jobs",
        actor="admin-log@example.com",
        role="admin",
        metadata={"job_id": 123},
    )
    audit_log.record(
        event_type="admin_access_denied",
        path="/api/admin/batch/jobs",
        actor="member-1",
        role="member",
        metadata={"reason": "insufficient_role"},
    )

    response = client.get(
        "/api/admin/logs?limit=1&offset=0", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert "pagination" in body
    assert len(body["items"]) == 1
    assert body["pagination"]["total"] >= 2


def test_admin_logs_filters_by_result_and_event_type() -> None:
    client = TestClient(app)
    audit_event_repository.delete_all()
    _create_user("admin-filter@example.com", "admin")
    token = _login(client, "admin-filter@example.com")

    audit_log.record(
        event_type="crawler_run_triggered",
        path="/api/admin/batch/crawler/jobs",
        actor="admin-filter@example.com",
        role="admin",
        metadata={"job_id": 101},
    )
    audit_log.record(
        event_type="admin_access_denied",
        path="/api/admin/logs",
        actor="member-2",
        role="member",
    )

    response = client.get(
        "/api/admin/logs?event_type=admin_access_denied&result=denied",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["event_type"] == "admin_access_denied"
    assert items[0]["result"] == "denied"
