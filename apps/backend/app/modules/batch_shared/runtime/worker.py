"""Worker runtime for batch jobs."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from app.modules.batch_shared.config.settings import BatchSettings, load_batch_settings
from app.modules.batch_shared.jobs.interfaces import JobImplementation, JobResult
from app.modules.batch_shared.jobs.job_runner import JobRunner
from app.modules.batch_shared.metrics.metrics import BatchMetrics
from app.modules.batch_shared.repositories.job_repository import JobRepository
from app.modules.batch_shared.retry.policy import RetryPolicy


@dataclass
class WorkerRuntime:
    settings: BatchSettings
    runner: JobRunner
    registry: dict[str, JobImplementation]

    def register_job(self, job_type: str, job_impl: JobImplementation) -> None:
        self.registry[job_type] = job_impl

    def run_job(self, job_type: str, params: dict[str, Any]) -> JobResult:
        if job_type not in self.registry:
            raise RuntimeError(f"unknown job_type: {job_type}")
        return self.runner.run(job_type=job_type, params=params, job_impl=self.registry[job_type])


def build_worker_runtime(settings: BatchSettings | None = None) -> WorkerRuntime:
    settings = settings or load_batch_settings()
    logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))

    metrics = BatchMetrics()
    repository = JobRepository()
    retry_policy = RetryPolicy(
        max_attempts=settings.retry_max_attempts,
        backoff_seconds=settings.retry_backoff_seconds,
    )
    runner = JobRunner(repository=repository, retry_policy=retry_policy, metrics=metrics)
    return WorkerRuntime(settings=settings, runner=runner, registry={})
