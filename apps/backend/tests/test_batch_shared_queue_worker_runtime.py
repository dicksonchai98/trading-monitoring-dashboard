from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace

from app.modules.batch_shared.runtime.worker import QueueWorkerRuntime


class FakeBatchQueue:
    def __init__(self, job_ids: list[int]) -> None:
        self.job_ids = list(job_ids)

    def dequeue_blocking(self, worker_type: str, timeout_seconds: int = 0) -> int | None:
        _ = (worker_type, timeout_seconds)
        if not self.job_ids:
            return None
        return self.job_ids.pop(0)


@dataclass
class FakeRunner:
    executed_job_ids: list[int]

    def run_existing_job(self, job_id: int, job_impl):
        _ = job_impl
        self.executed_job_ids.append(job_id)
        return SimpleNamespace(rows_processed=1)


class FakeRepository:
    def __init__(self, job) -> None:
        self.job = job

    def get_job(self, job_id: int):
        _ = job_id
        return self.job


def test_queue_worker_runtime_dequeues_and_executes_matching_job() -> None:
    queue = FakeBatchQueue(job_ids=[41])
    repo = FakeRepository(
        SimpleNamespace(
            id=41,
            worker_type="historical_backfill",
            job_type="historical-backfill",
            metadata_json={
                "code": "TXF",
                "start_date": "2026-03-01",
                "end_date": "2026-03-10",
                "overwrite_mode": "force",
            },
        )
    )
    fake_runner = FakeRunner(executed_job_ids=[])
    runtime = QueueWorkerRuntime(
        settings=SimpleNamespace(queue_block_timeout_seconds=1),
        worker_type="historical_backfill",
        queue=queue,
        repository=repo,
        runner=fake_runner,
        registry={"historical-backfill": object()},
    )

    runtime.run_once()

    assert fake_runner.executed_job_ids == [41]
