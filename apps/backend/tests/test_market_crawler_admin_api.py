from __future__ import annotations

from datetime import date

from app.db.session import SessionLocal
from app.main import app
from app.repositories.user_repository import UserRepository
from app.security.passwords import hash_password
from app.state import audit_log
from fastapi.testclient import TestClient


def _create_admin(username: str = "admin1", password: str = "admin-pass") -> None:
    repo = UserRepository(session_factory=SessionLocal)
    repo.create_user(username=username, password_hash=hash_password(password), role="admin")


def _login(client: TestClient, username: str, password: str) -> str:
    res = client.post("/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_admin_can_trigger_crawler_run_and_audit_event() -> None:
    client = TestClient(app)
    _create_admin()
    token = _login(client, "admin1", "admin-pass")

    res = client.post(
        "/admin/crawler/run",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "dataset_code": "taifex_institution_open_interest_daily",
            "target_date": "2026-03-09",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "CREATED"
    assert "job_id" in body
    assert any(event.event_type == "crawler_run_triggered" for event in audit_log.events)


def test_admin_backfill_returns_correlation_id() -> None:
    client = TestClient(app)
    _create_admin(username="admin2", password="admin-pass-2")
    token = _login(client, "admin2", "admin-pass-2")

    res = client.post(
        "/admin/crawler/backfill",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "dataset_code": "taifex_institution_open_interest_daily",
            "start_date": "2026-03-07",
            "end_date": "2026-03-09",
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert payload["status"] == "CREATED"
    assert payload["parent_job_id"] is not None
    assert payload["correlation_id"] is not None


def test_non_admin_cannot_trigger_crawler() -> None:
    client = TestClient(app)
    # create a non-admin user via register
    register = client.post("/auth/register", json={"username": "user4", "password": "pass4"})
    assert register.status_code == 200
    token = client.post("/auth/login", json={"username": "user4", "password": "pass4"}).json()[
        "access_token"
    ]

    res = client.post(
        "/admin/crawler/run",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "dataset_code": "taifex_institution_open_interest_daily",
            "target_date": date.today().isoformat(),
        },
    )
    assert res.status_code == 403
