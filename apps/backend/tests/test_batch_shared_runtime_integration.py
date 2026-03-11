from __future__ import annotations

from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.models.batch_job import BatchJobModel
from app.modules.batch_shared.jobs.interfaces import JobResult
from app.modules.batch_shared.jobs.job_runner import JobRunner
from app.modules.batch_shared.metrics.metrics import BatchMetrics
from app.modules.batch_shared.repositories.job_repository import JobRepository
from app.modules.batch_shared.retry.policy import RetryPolicy


def test_job_runner_persists_job_and_emits_metrics() -> None:
    repository = JobRepository()
    metrics = BatchMetrics()
    retry_policy = RetryPolicy(max_attempts=2, backoff_seconds=0)
    runner = JobRunner(repository=repository, retry_policy=retry_policy, metrics=metrics)

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

    runner.run(job_type="integration-job", params={"foo": "bar"}, job_impl=_FlakyJob())

    jobs = repository.list_jobs("integration-job")
    assert jobs
    job_id = max(job.id for job in jobs)

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
