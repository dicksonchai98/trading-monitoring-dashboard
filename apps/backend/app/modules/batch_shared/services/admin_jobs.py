"""Shared admin service for creating and enqueueing batch jobs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.models.batch_job import BatchJobModel
from app.modules.batch_shared.queue.redis_queue import RedisBatchQueue
from app.modules.batch_shared.repositories.job_repository import JobRepository


@dataclass
class BatchJobAdminService:
    repository: JobRepository
    queue: RedisBatchQueue

    def create_and_enqueue(
        self,
        *,
        worker_type: str,
        job_type: str,
        dedupe_key: str | None,
        metadata: dict[str, Any],
    ) -> BatchJobModel:
        job = self.repository.create_job(
            worker_type=worker_type,
            job_type=job_type,
            dedupe_key=dedupe_key,
            metadata=metadata,
        )
        self.queue.enqueue(worker_type=worker_type, job_id=job.id)
        return job

    def ensure_enqueued(self, *, worker_type: str, job_id: int) -> None:
        self.queue.enqueue_if_missing(worker_type=worker_type, job_id=job_id)
