from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace

from app.modules.batch_shared.jobs.interfaces import JobResult, JobStatus
from app.modules.batch_shared.jobs.job_runner import JobRunner
from app.modules.batch_shared.retry.policy import RetryPolicy


@dataclass
class _FakeMetrics:
    counters: dict[str, int]
    gauges: dict[str, float]

    def inc(self, key: str, value: int = 1) -> None:
        self.counters[key] = self.counters.get(key, 0) + value

    def set_gauge(self, key: str, value: float) -> None:
        self.gauges[key] = value


@dataclass
class _FakeRepository:
    statuses: list[str]
    progress_calls: list[dict[str, object]]

    def create_job(self, job_type: str, metadata: dict[str, object] | None = None):
        _ = (job_type, metadata)
        return SimpleNamespace(id=1)

    def mark_running(self, job_id: int) -> None:
        _ = job_id
        self.statuses.append(JobStatus.RUNNING.value)

    def mark_retrying(self, job_id: int, retry_count: int) -> None:
        _ = (job_id, retry_count)
        self.statuses.append(JobStatus.RETRYING.value)

    def mark_completed(self, job_id: int, rows_processed: int = 0) -> None:
        _ = (job_id, rows_processed)
        self.statuses.append(JobStatus.COMPLETED.value)

    def mark_failed(self, job_id: int, error_message: str | None = None) -> None:
        _ = (job_id, error_message)
        self.statuses.append(JobStatus.FAILED.value)

    def update_progress(
        self,
        job_id: int,
        rows_processed: int | None = None,
        *,
        rows_written: int | None = None,
        checkpoint_cursor: str | None = None,
        processed_chunks: int | None = None,
        total_chunks: int | None = None,
        last_heartbeat_at: datetime | None = None,
    ) -> None:
        self.progress_calls.append(
            {
                "job_id": job_id,
                "rows_processed": rows_processed,
                "rows_written": rows_written,
                "checkpoint_cursor": checkpoint_cursor,
                "processed_chunks": processed_chunks,
                "total_chunks": total_chunks,
                "last_heartbeat_at": last_heartbeat_at,
            }
        )


def test_job_runner_transitions_retry_to_running_to_completed() -> None:
    repository = _FakeRepository(statuses=[], progress_calls=[])
    metrics = _FakeMetrics(counters={}, gauges={})
    runner = JobRunner(
        repository=repository,
        retry_policy=RetryPolicy(max_attempts=2, backoff_seconds=0),
        metrics=metrics,
    )

    class _FlakyJob:
        def __init__(self) -> None:
            self.calls = 0

        def execute(self, params: dict[str, object], context) -> JobResult:
            _ = params
            _ = context
            self.calls += 1
            if self.calls == 1:
                raise TimeoutError("temporary timeout")
            return JobResult(rows_processed=3)

    result = runner.run(job_type="test-job", params={}, job_impl=_FlakyJob())

    assert result.normalized_rows_processed == 3
    assert repository.statuses == [
        JobStatus.RUNNING.value,
        JobStatus.RETRYING.value,
        JobStatus.RUNNING.value,
        JobStatus.COMPLETED.value,
    ]


def test_job_runner_progress_supports_rows_written_and_checkpoint_contract() -> None:
    repository = _FakeRepository(statuses=[], progress_calls=[])
    metrics = _FakeMetrics(counters={}, gauges={})
    runner = JobRunner(
        repository=repository,
        retry_policy=RetryPolicy(max_attempts=1, backoff_seconds=0),
        metrics=metrics,
    )
    heartbeat = datetime.now(tz=timezone.utc)

    class _CheckpointJob:
        def execute(self, params: dict[str, object], context) -> JobResult:
            _ = params
            context.update_progress(
                rows_written=5,
                checkpoint_cursor="2026-03-09:chunk-01",
                processed_chunks=1,
                total_chunks=3,
                last_heartbeat_at=heartbeat,
            )
            return JobResult(rows_written=5)

    result = runner.run(job_type="test-job", params={}, job_impl=_CheckpointJob())

    assert result.normalized_rows_processed == 5
    assert repository.progress_calls == [
        {
            "job_id": 1,
            "rows_processed": None,
            "rows_written": 5,
            "checkpoint_cursor": "2026-03-09:chunk-01",
            "processed_chunks": 1,
            "total_chunks": 3,
            "last_heartbeat_at": heartbeat,
        }
    ]
