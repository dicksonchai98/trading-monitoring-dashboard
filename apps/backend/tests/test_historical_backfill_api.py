from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient
from scripts.seed_admin import seed_admin


def _login(client: TestClient, username: str, password: str) -> str:
    res = client.post("/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200
    return str(res.json()["access_token"])


def _admin_headers(client: TestClient, monkeypatch) -> dict[str, str]:
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    monkeypatch.setenv("ADMIN_PASSWORD", "admin-pass")
    seed_admin()
    token = _login(client, "admin", "admin-pass")
    return {"Authorization": f"Bearer {token}"}


def test_backfill_admin_routes_reject_non_admin() -> None:
    client = TestClient(app)
    register = client.post("/auth/register", json={"username": "u1", "password": "p1"})
    assert register.status_code == 200
    token = _login(client, "u1", "p1")
    headers = {"Authorization": f"Bearer {token}"}

    trigger = client.post(
        "/api/admin/backfill/historical-jobs",
        json={"code": "TXF", "start_date": "2026-03-01", "end_date": "2026-03-02"},
        headers=headers,
    )
    assert trigger.status_code == 403

    listed = client.get("/api/admin/backfill/historical-jobs", headers=headers)
    assert listed.status_code == 403


def test_backfill_trigger_returns_202_with_job_id(monkeypatch) -> None:
    client = TestClient(app)
    headers = _admin_headers(client, monkeypatch)
    res = client.post(
        "/api/admin/backfill/historical-jobs",
        json={
            "code": "TXF",
            "start_date": "2026-03-01",
            "end_date": "2026-03-02",
            "overwrite_mode": "closed_only",
        },
        headers=headers,
    )
    assert res.status_code == 202
    payload = res.json()
    assert isinstance(payload.get("job_id"), int)
    assert payload.get("status") in {"created", "running", "retrying", "completed", "failed"}


def test_backfill_trigger_deduplicates_active_job(monkeypatch) -> None:
    client = TestClient(app)
    headers = _admin_headers(client, monkeypatch)
    body = {
        "code": "TXF",
        "start_date": "2026-03-01",
        "end_date": "2026-03-02",
        "overwrite_mode": "closed_only",
    }
    first = client.post("/api/admin/backfill/historical-jobs", json=body, headers=headers)
    assert first.status_code == 202
    second = client.post("/api/admin/backfill/historical-jobs", json=body, headers=headers)
    assert second.status_code == 202
    assert second.json()["job_id"] == first.json()["job_id"]


def test_backfill_list_supports_status_and_pagination(monkeypatch) -> None:
    client = TestClient(app)
    headers = _admin_headers(client, monkeypatch)
    for day in ("2026-03-01", "2026-03-02", "2026-03-03"):
        res = client.post(
            "/api/admin/backfill/historical-jobs",
            json={"code": "TXF", "start_date": day, "end_date": day},
            headers=headers,
        )
        assert res.status_code == 202

    listed = client.get(
        "/api/admin/backfill/historical-jobs?status=created&limit=2&offset=0",
        headers=headers,
    )
    assert listed.status_code == 200
    payload = listed.json()
    assert "items" in payload
    assert "pagination" in payload
    assert payload["pagination"]["limit"] == 2
    assert payload["pagination"]["offset"] == 0


def test_backfill_detail_returns_progress_fields(monkeypatch) -> None:
    client = TestClient(app)
    headers = _admin_headers(client, monkeypatch)
    trigger = client.post(
        "/api/admin/backfill/historical-jobs",
        json={"code": "TXF", "start_date": "2026-03-01", "end_date": "2026-03-01"},
        headers=headers,
    )
    assert trigger.status_code == 202
    job_id = trigger.json()["job_id"]

    detail = client.get(f"/api/admin/backfill/historical-jobs/{job_id}", headers=headers)
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["job_id"] == job_id
    for key in (
        "status",
        "rows_processed",
        "processed_chunks",
        "total_chunks",
        "last_heartbeat_at",
    ):
        assert key in payload
