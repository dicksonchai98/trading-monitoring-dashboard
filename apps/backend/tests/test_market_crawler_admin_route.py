from __future__ import annotations

from app.db.session import SessionLocal
from app.main import app
from app.repositories.user_repository import UserRepository
from app.routes import market_crawler
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


class FakeBatchQueue:
    def __init__(self) -> None:
        self.enqueued: list[tuple[str, int]] = []

    def enqueue(self, *, worker_type: str, job_id: int) -> None:
        self.enqueued.append((worker_type, job_id))


def test_crawler_single_date_create_writes_shared_batch_job(monkeypatch) -> None:
    client = TestClient(app)
    _create_admin()
    token = _login(client, "admin1", "admin-pass")
    fake_queue = FakeBatchQueue()

    def _service():
        repository = market_crawler.JobRepository()
        batch_admin_service = market_crawler.BatchJobAdminService(
            repository=repository, queue=fake_queue
        )
        return market_crawler.MarketCrawlerAdminJobService(
            repository=repository,
            batch_admin_service=batch_admin_service,
        )

    monkeypatch.setattr(market_crawler, "_crawler_service", _service)

    response = client.post(
        "/api/admin/batch/crawler/jobs",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "dataset_code": "taifex_institution_open_interest_daily",
            "target_date": "2026-03-15",
            "trigger_type": "manual",
        },
    )
    assert response.status_code == 202
    body = response.json()
    assert body["worker_type"] == "market_crawler"
    assert body["job_type"] == "crawler-single-date"
    assert body["status"] == "CREATED"
    assert len(fake_queue.enqueued) == 1
    assert any(event.event_type == "crawler_run_triggered" for event in audit_log.events)


def test_non_admin_cannot_create_crawler_job() -> None:
    client = TestClient(app)
    register = client.post("/auth/register", json={"username": "user4", "password": "pass4"})
    assert register.status_code == 200
    token = client.post("/auth/login", json={"username": "user4", "password": "pass4"}).json()[
        "access_token"
    ]

    res = client.post(
        "/api/admin/batch/crawler/jobs",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "dataset_code": "taifex_institution_open_interest_daily",
            "target_date": "2026-03-15",
        },
    )
    assert res.status_code == 403
