from __future__ import annotations

import json

from app.main import app
from app.modules.batch_shared.repositories.job_repository import JobRepository
from app.modules.batch_shared.services.admin_jobs import BatchJobAdminService
from app.routes import historical_backfill
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


class FakeBatchQueue:
    def __init__(self) -> None:
        self.enqueued: list[tuple[str, int]] = []

    def enqueue(self, *, worker_type: str, job_id: int) -> None:
        self.enqueued.append((worker_type, job_id))

    def enqueue_if_missing(self, *, worker_type: str, job_id: int) -> None:
        item = (worker_type, job_id)
        if item in self.enqueued:
            return
        self.enqueued.append(item)


def test_backfill_create_returns_existing_active_job(monkeypatch) -> None:
    client = TestClient(app)
    headers = _admin_headers(client, monkeypatch)
    fake_queue = FakeBatchQueue()

    def _fake_service():
        repository = JobRepository()
        return historical_backfill.HistoricalBackfillService(
            repository=repository,
            batch_admin_service=BatchJobAdminService(
                repository=repository,
                queue=fake_queue,
            ),
            audit_log=historical_backfill.audit_log,
        )

    monkeypatch.setattr(historical_backfill, "_service", _fake_service)
    payload = {
        "code": "TXF",
        "start_date": "2026-03-01",
        "end_date": "2026-03-10",
        "overwrite_mode": "force",
    }
    first = client.post("/api/admin/batch/backfill/jobs", json=payload, headers=headers)
    second = client.post("/api/admin/batch/backfill/jobs", json=payload, headers=headers)

    assert first.status_code == 202
    assert second.status_code == 202
    assert second.json()["job_id"] == first.json()["job_id"]
    assert fake_queue.enqueued == [("historical_backfill", first.json()["job_id"])]


def test_backfill_create_returns_shared_batch_job_shape(monkeypatch) -> None:
    client = TestClient(app)
    headers = _admin_headers(client, monkeypatch)
    fake_queue = FakeBatchQueue()

    def _fake_service():
        repository = JobRepository()
        return historical_backfill.HistoricalBackfillService(
            repository=repository,
            batch_admin_service=BatchJobAdminService(
                repository=repository,
                queue=fake_queue,
            ),
            audit_log=historical_backfill.audit_log,
        )

    monkeypatch.setattr(historical_backfill, "_service", _fake_service)

    response = client.post(
        "/api/admin/batch/backfill/jobs",
        json={
            "code": "TXF",
            "start_date": "2026-03-01",
            "end_date": "2026-03-02",
            "overwrite_mode": "closed_only",
        },
        headers=headers,
    )

    assert response.status_code == 202
    body = response.json()
    assert body["worker_type"] == "historical_backfill"
    assert body["job_type"] == "historical-backfill"
    assert body["status"] == "CREATED"


def test_backfill_reenqueues_stuck_created_job(monkeypatch) -> None:
    client = TestClient(app)
    headers = _admin_headers(client, monkeypatch)
    fake_queue = FakeBatchQueue()
    repository = JobRepository()

    metadata = {
        "code": "TXFD6",
        "start_date": "2026-01-07",
        "end_date": "2026-04-07",
        "overwrite_mode": "closed_only",
    }
    existing = repository.create_job(
        worker_type="historical_backfill",
        job_type="historical-backfill",
        dedupe_key=json.dumps(metadata, sort_keys=True, separators=(",", ":"), ensure_ascii=True),
        metadata=metadata,
    )

    def _fake_service():
        return historical_backfill.HistoricalBackfillService(
            repository=repository,
            batch_admin_service=BatchJobAdminService(
                repository=repository,
                queue=fake_queue,
            ),
            audit_log=historical_backfill.audit_log,
        )

    monkeypatch.setattr(historical_backfill, "_service", _fake_service)

    response = client.post(
        "/api/admin/batch/backfill/jobs",
        json=metadata,
        headers=headers,
    )

    assert response.status_code == 202
    assert response.json()["job_id"] == existing.id
    assert fake_queue.enqueued == [("historical_backfill", existing.id)]


def test_non_admin_cannot_create_backfill_job() -> None:
    client = TestClient(app)
    send = client.post("/auth/email/send-otp", json={"email": "user-bf@example.com"})
    assert send.status_code == 202
    verify = client.post(
        "/auth/email/verify-otp",
        json={"email": "user-bf@example.com", "otp_code": "123456"},
    )
    register = client.post(
        "/auth/register",
        json={
            "username": "user-bf@example.com",
            "password": "Passbf123",
            "verification_token": verify.json()["verification_token"],
        },
    )
    assert register.status_code == 200
    token = client.post(
        "/auth/login",
        json={"username": "user-bf@example.com", "password": "Passbf123"},
    ).json()["access_token"]

    response = client.post(
        "/api/admin/batch/backfill/jobs",
        json={
            "code": "TXF",
            "start_date": "2026-03-01",
            "end_date": "2026-03-02",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
