"""Job repository for batch jobs."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from app.models.batch_job import BatchJobModel
from app.modules.batch_shared.database.session import session_scope
from app.modules.batch_shared.jobs.interfaces import JobStatus


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class JobRepository:
    def create_job(self, job_type: str, metadata: dict[str, Any] | None = None) -> BatchJobModel:
        with session_scope() as session:
            job = BatchJobModel(
                job_type=job_type,
                status=JobStatus.CREATED.value,
                created_at=_utcnow(),
                metadata_json=metadata or {},
            )
            session.add(job)
            session.flush()
            session.refresh(job)
            return job

    def mark_running(self, job_id: int) -> None:
        with session_scope() as session:
            job = session.get(BatchJobModel, job_id)
            if job is None:
                return
            job.status = JobStatus.RUNNING.value
            if job.started_at is None:
                job.started_at = _utcnow()

    def mark_retrying(self, job_id: int, retry_count: int) -> None:
        with session_scope() as session:
            job = session.get(BatchJobModel, job_id)
            if job is None:
                return
            job.status = JobStatus.RETRYING.value
            job.retry_count = retry_count

    def mark_completed(self, job_id: int, rows_processed: int = 0) -> None:
        with session_scope() as session:
            job = session.get(BatchJobModel, job_id)
            if job is None:
                return
            job.status = JobStatus.COMPLETED.value
            job.finished_at = _utcnow()
            job.rows_processed = rows_processed
            if job.total_chunks is not None and job.total_chunks > 0:
                job.processed_chunks = job.total_chunks
            job.last_heartbeat_at = _utcnow()

    def mark_failed(self, job_id: int, error_message: str | None = None) -> None:
        with session_scope() as session:
            job = session.get(BatchJobModel, job_id)
            if job is None:
                return
            job.status = JobStatus.FAILED.value
            job.finished_at = _utcnow()
            job.error_message = error_message

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
        with session_scope() as session:
            job = session.get(BatchJobModel, job_id)
            if job is None:
                return
            effective_rows = rows_processed if rows_processed is not None else rows_written
            if effective_rows is not None:
                job.rows_processed = effective_rows
            if checkpoint_cursor is not None:
                job.checkpoint_cursor = checkpoint_cursor
            if processed_chunks is not None:
                job.processed_chunks = processed_chunks
            if total_chunks is not None:
                job.total_chunks = total_chunks
            job.last_heartbeat_at = last_heartbeat_at or _utcnow()

            has_chunk_progress = (
                job.total_chunks is not None
                and job.total_chunks > 0
                and job.processed_chunks < job.total_chunks
            )
            if has_chunk_progress and job.status in {
                JobStatus.RUNNING.value,
                JobStatus.RETRYING.value,
                JobStatus.PARTIALLY_COMPLETED.value,
            }:
                job.status = JobStatus.PARTIALLY_COMPLETED.value
            elif not has_chunk_progress and job.status == JobStatus.PARTIALLY_COMPLETED.value:
                job.status = JobStatus.RUNNING.value

    def get_job(self, job_id: int) -> BatchJobModel | None:
        with session_scope() as session:
            return session.get(BatchJobModel, job_id)

    def list_jobs(self, job_type: str) -> list[BatchJobModel]:
        with session_scope() as session:
            stmt = select(BatchJobModel).where(BatchJobModel.job_type == job_type)
            return list(session.execute(stmt).scalars())
