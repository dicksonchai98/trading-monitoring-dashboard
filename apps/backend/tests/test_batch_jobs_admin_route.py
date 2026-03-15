from __future__ import annotations

from app.main import app
from app.modules.batch_shared.repositories.job_repository import JobRepository
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


def test_list_batch_jobs_filters_by_worker_type(monkeypatch) -> None:
    client = TestClient(app)
    headers = _admin_headers(client, monkeypatch)
    repository = JobRepository()
    repository.create_job(
        worker_type="market_crawler",
        job_type="crawler-single-date",
        metadata={"dataset_code": "oi", "target_date": "2026-03-15"},
    )
    repository.create_job(
        worker_type="historical_backfill",
        job_type="historical-backfill",
        metadata={"code": "TXF", "start_date": "2026-03-01", "end_date": "2026-03-02"},
    )

    response = client.get("/api/admin/batch/jobs?worker_type=market_crawler", headers=headers)

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert all(item["worker_type"] == "market_crawler" for item in items)


def test_get_batch_job_returns_detail(monkeypatch) -> None:
    client = TestClient(app)
    headers = _admin_headers(client, monkeypatch)
    repository = JobRepository()
    created = repository.create_job(
        worker_type="market_crawler",
        job_type="crawler-single-date",
        metadata={"dataset_code": "oi", "target_date": "2026-03-15"},
    )

    response = client.get(f"/api/admin/batch/jobs/{created.id}", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["job_id"] == created.id
    assert body["worker_type"] == "market_crawler"
