from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from app.db.session import SessionLocal
from app.models.batch_job import BatchJobModel
from app.modules.batch_shared.jobs.interfaces import JobResult
from app.modules.batch_shared.jobs.job_runner import JobRunner
from app.modules.batch_shared.metrics.metrics import BatchMetrics
from app.modules.batch_shared.repositories.job_repository import JobRepository
from app.modules.batch_shared.retry.policy import RetryPolicy
from app.modules.batch_shared.runtime.worker import QueueWorkerRuntime
from app.modules.batch_shared.services.admin_jobs import BatchJobAdminService


def test_job_runner_persists_job_and_emits_metrics() -> None:
    repository = JobRepository()
    metrics = BatchMetrics()
    retry_policy = RetryPolicy(max_attempts=2, backoff_seconds=0)
    runner = JobRunner(repository=repository, retry_policy=retry_policy, metrics=metrics)
    created = repository.create_job(
        worker_type="batch-worker",
        job_type="integration-job",
        metadata={"foo": "bar"},
    )

    class _FlakyJob:
        def __init__(self) -> None:
            self.calls = 0

        def execute(self, params, context):  # type: ignore[no-untyped-def]
            self.calls += 1
            context.update_progress(
                rows_written=5,
                checkpoint_cursor="chunk-02",
                processed_chunks=1,
                total_chunks=2,
                last_heartbeat_at=datetime(2026, 3, 11, tzinfo=timezone.utc),
            )
            if self.calls == 1:
                raise TimeoutError("retry me")
            return JobResult(rows_written=5)

    runner.run_existing_job(job_id=created.id, job_impl=_FlakyJob())
    job_id = created.id

    with SessionLocal() as session:
        stored = session.get(BatchJobModel, job_id)
        assert stored is not None
        assert stored.status == "COMPLETED"
        assert stored.started_at is not None
        assert stored.finished_at is not None
        assert stored.rows_processed == 5
        assert stored.checkpoint_cursor == "chunk-02"
        assert stored.processed_chunks == 2
        assert stored.total_chunks == 2
        assert stored.metadata_json == {"foo": "bar"}

    assert metrics.counters["batch_retry_count_total"] == 1
    assert metrics.counters["batch_rows_processed_total"] == 5
    assert metrics.counters["batch_job_failures_total"] == 0
    assert metrics.counters["batch_job_duration_seconds"] >= 0


class _FakeQueue:
    def __init__(self) -> None:
        self.job_ids: list[int] = []

    def enqueue(self, *, worker_type: str, job_id: int) -> None:
        _ = worker_type
        self.job_ids.append(job_id)

    def dequeue_blocking(self, worker_type: str, timeout_seconds: int = 0) -> int | None:
        _ = (worker_type, timeout_seconds)
        if not self.job_ids:
            return None
        return self.job_ids.pop(0)


def test_admin_create_then_worker_consume_updates_batch_job_lifecycle() -> None:
    repository = JobRepository()
    queue = _FakeQueue()
    service = BatchJobAdminService(repository=repository, queue=queue)
    metrics = BatchMetrics()
    runner = JobRunner(
        repository=repository,
        retry_policy=RetryPolicy(max_attempts=1, backoff_seconds=0),
        metrics=metrics,
    )

    class _FakeJob:
        def execute(self, params, context):  # type: ignore[no-untyped-def]
            _ = params
            context.update_progress(rows_processed=2)
            return JobResult(rows_processed=2)

    runtime = QueueWorkerRuntime(
        settings=SimpleNamespace(queue_block_timeout_seconds=1),
        worker_type="market_crawler",
        queue=queue,
        repository=repository,
        runner=runner,
        registry={"crawler-single-date": _FakeJob()},
    )

    created = service.create_and_enqueue(
        worker_type="market_crawler",
        job_type="crawler-single-date",
        dedupe_key="crawler:oi:2026-03-15",
        metadata={"dataset_code": "oi", "target_date": "2026-03-15"},
    )

    runtime.run_once()

    with SessionLocal() as session:
        stored = session.get(BatchJobModel, created.id)
        assert stored is not None
        assert stored.status == "COMPLETED"
        assert stored.started_at is not None
        assert stored.finished_at is not None
        assert stored.rows_processed == 2
