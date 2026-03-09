"""Job runner for batch shared runtime."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from app.modules.batch_shared.jobs.interfaces import JobContext, JobImplementation, JobResult
from app.modules.batch_shared.logging.context import JobLogContext, get_job_logger
from app.modules.batch_shared.metrics.metrics import BatchMetrics
from app.modules.batch_shared.repositories.job_repository import JobRepository
from app.modules.batch_shared.retry.errors import error_context
from app.modules.batch_shared.retry.policy import RetryPolicy


@dataclass
class JobRunner:
    repository: JobRepository
    retry_policy: RetryPolicy
    metrics: BatchMetrics
    logger_name: str = "batch_runtime"

    def run(self, job_type: str, params: dict[str, Any], job_impl: JobImplementation) -> JobResult:
        job = self.repository.create_job(job_type=job_type, metadata=params)
        start_time = time.perf_counter()
        logger = get_job_logger(
            self.logger_name,
            JobLogContext(job_id=job.id, job_type=job_type, execution_stage="start"),
        )
        logger.info("job starting")

        context = JobContext(job_id=job.id, job_type=job_type)

        def update_progress(
            rows_processed: int | None = None,
            *,
            rows_written: int | None = None,
            checkpoint_cursor: str | None = None,
            processed_chunks: int | None = None,
            total_chunks: int | None = None,
            last_heartbeat_at: Any | None = None,
        ) -> None:
            self.repository.update_progress(
                job.id,
                rows_processed=rows_processed,
                rows_written=rows_written,
                checkpoint_cursor=checkpoint_cursor,
                processed_chunks=processed_chunks,
                total_chunks=total_chunks,
                last_heartbeat_at=last_heartbeat_at,
            )

        context.update_progress = update_progress

        def operation() -> JobResult:
            self.repository.mark_running(job.id)
            return job_impl.execute(params=params, context=context)

        def on_retry(attempt: int, _category: object) -> None:
            self.repository.mark_retrying(job.id, attempt)
            self.metrics.inc("batch_retry_count_total", 1)
            retry_logger = get_job_logger(
                self.logger_name,
                JobLogContext(job_id=job.id, job_type=job_type, execution_stage="retry"),
            )
            retry_logger.warning("job retry scheduled", extra={"attempt": attempt})

        try:
            result = self.retry_policy.run(operation, on_retry)
        except Exception as err:
            err_ctx = error_context(err)
            self.repository.mark_failed(job.id, error_message=err_ctx["error_message"])
            self.metrics.inc("batch_job_failures_total", 1)
            elapsed = time.perf_counter() - start_time
            fail_logger = get_job_logger(
                self.logger_name,
                JobLogContext(job_id=job.id, job_type=job_type, execution_stage="failed"),
                elapsed_time=elapsed,
                error_message=err_ctx["error_message"],
            )
            fail_logger.error("job failed", extra=err_ctx)
            raise

        elapsed = time.perf_counter() - start_time
        rows_processed = result.normalized_rows_processed
        self.repository.mark_completed(job.id, rows_processed=rows_processed)
        self.metrics.inc("batch_rows_processed_total", rows_processed)
        self.metrics.set_gauge("batch_job_duration_seconds", elapsed)
        complete_logger = get_job_logger(
            self.logger_name,
            JobLogContext(job_id=job.id, job_type=job_type, execution_stage="complete"),
            elapsed_time=elapsed,
        )
        complete_logger.info("job completed")
        return result
