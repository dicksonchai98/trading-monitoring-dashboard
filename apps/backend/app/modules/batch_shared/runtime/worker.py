"""Worker runtime for batch jobs."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.modules.batch_shared.config.settings import BatchSettings, load_batch_settings
from app.modules.batch_shared.jobs.interfaces import JobImplementation, JobResult
from app.modules.batch_shared.jobs.job_runner import JobRunner
from app.modules.batch_shared.metrics.metrics import BatchMetrics
from app.modules.batch_shared.queue.redis_queue import RedisBatchQueue
from app.modules.batch_shared.repositories.job_repository import JobRepository
from app.modules.batch_shared.retry.policy import RetryPolicy


@dataclass
class QueueWorkerRuntime:
    settings: BatchSettings
    worker_type: str
    queue: RedisBatchQueue
    repository: JobRepository
    runner: JobRunner
    registry: dict[str, JobImplementation]

    def register_job(self, job_type: str, job_impl: JobImplementation) -> None:
        self.registry[job_type] = job_impl

    def run_once(self) -> JobResult | None:
        job_id = self.queue.dequeue_blocking(
            self.worker_type,
            timeout_seconds=self.settings.queue_block_timeout_seconds,
        )
        if job_id is None:
            return None
        job = self.repository.get_job(job_id)
        if job is None or job.worker_type != self.worker_type:
            return None
        if job.job_type not in self.registry:
            raise RuntimeError(f"unknown job_type: {job.job_type}")
        return self.runner.run_existing_job(job_id=job_id, job_impl=self.registry[job.job_type])

    def run_forever(self) -> None:
        while True:
            self.run_once()


def _build_queue(settings: BatchSettings) -> RedisBatchQueue:
    try:
        import redis
    except ImportError as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("redis package is required for batch worker queue operations") from err
    return RedisBatchQueue(client=redis.Redis.from_url(settings.redis_url, decode_responses=True))


def build_worker_runtime(
    worker_type: str,
    settings: BatchSettings | None = None,
    queue: RedisBatchQueue | None = None,
) -> QueueWorkerRuntime:
    settings = settings or load_batch_settings()
    logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))

    metrics = BatchMetrics()
    repository = JobRepository()
    retry_policy = RetryPolicy(
        max_attempts=settings.retry_max_attempts,
        backoff_seconds=settings.retry_backoff_seconds,
    )
    runner = JobRunner(repository=repository, retry_policy=retry_policy, metrics=metrics)
    return QueueWorkerRuntime(
        settings=settings,
        worker_type=worker_type,
        queue=queue or _build_queue(settings),
        repository=repository,
        runner=runner,
        registry={},
    )
