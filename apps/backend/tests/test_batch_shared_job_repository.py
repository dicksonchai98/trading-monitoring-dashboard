from __future__ import annotations

from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.models.batch_job import BatchJobModel
from app.modules.batch_shared.jobs.interfaces import JobStatus
from app.modules.batch_shared.repositories.job_repository import JobRepository


def test_job_repository_lifecycle_and_progress_updates() -> None:
    repo = JobRepository()
    job = repo.create_job(job_type="unit-test", metadata={"foo": "bar"})

    assert job.id is not None
    assert job.status == JobStatus.CREATED.value

    repo.mark_running(job.id)
    repo.update_progress(
        job.id,
        rows_processed=10,
        checkpoint_cursor="chunk-01",
        processed_chunks=1,
        total_chunks=3,
        last_heartbeat_at=datetime(2026, 3, 11, tzinfo=timezone.utc),
    )

    with SessionLocal() as session:
        stored = session.get(BatchJobModel, job.id)
        assert stored is not None
        assert stored.status == JobStatus.PARTIALLY_COMPLETED.value
        assert stored.rows_processed == 10
        assert stored.checkpoint_cursor == "chunk-01"
        assert stored.processed_chunks == 1
        assert stored.total_chunks == 3
        assert stored.last_heartbeat_at is not None

    repo.mark_completed(job.id, rows_processed=25)
    with SessionLocal() as session:
        stored = session.get(BatchJobModel, job.id)
        assert stored is not None
        assert stored.status == JobStatus.COMPLETED.value
        assert stored.finished_at is not None
        assert stored.rows_processed == 25
        assert stored.processed_chunks == 3


def test_job_repository_failure_marks_error() -> None:
    repo = JobRepository()
    job = repo.create_job(job_type="unit-test")

    repo.mark_failed(job.id, error_message="boom")
    with SessionLocal() as session:
        stored = session.get(BatchJobModel, job.id)
        assert stored is not None
        assert stored.status == JobStatus.FAILED.value
        assert stored.error_message == "boom"
        assert stored.finished_at is not None
