from __future__ import annotations

from dataclasses import dataclass

from app.modules.batch_shared.services.admin_jobs import BatchJobAdminService


@dataclass
class FakeJob:
    id: int


class FakeJobRepository:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def create_job(
        self,
        *,
        worker_type: str,
        job_type: str,
        dedupe_key: str | None,
        metadata: dict[str, object],
    ) -> FakeJob:
        self.calls.append(
            {
                "worker_type": worker_type,
                "job_type": job_type,
                "dedupe_key": dedupe_key,
                "metadata": metadata,
            }
        )
        return FakeJob(id=1)


class FakeBatchQueue:
    def __init__(self) -> None:
        self.enqueued: list[tuple[str, int]] = []

    def enqueue(self, *, worker_type: str, job_id: int) -> None:
        self.enqueued.append((worker_type, job_id))


def test_create_and_enqueue_creates_job_and_pushes_queue_message() -> None:
    repo = FakeJobRepository()
    queue = FakeBatchQueue()
    service = BatchJobAdminService(repository=repo, queue=queue)

    job = service.create_and_enqueue(
        worker_type="market_crawler",
        job_type="crawler-single-date",
        dedupe_key="crawler:oi:2026-03-15",
        metadata={"dataset_code": "oi", "target_date": "2026-03-15"},
    )

    assert job.id == 1
    assert repo.calls == [
        {
            "worker_type": "market_crawler",
            "job_type": "crawler-single-date",
            "dedupe_key": "crawler:oi:2026-03-15",
            "metadata": {"dataset_code": "oi", "target_date": "2026-03-15"},
        }
    ]
    assert queue.enqueued == [("market_crawler", 1)]
