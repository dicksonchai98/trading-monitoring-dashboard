"""Dedicated runtime for historical backfill worker process."""

from __future__ import annotations

import logging
import signal
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Callable

from sqlalchemy.orm import Session

from app.config import (
    BACKFILL_FETCH_MIN_INTERVAL_SECONDS,
    BACKFILL_HEARTBEAT_INTERVAL_SECONDS,
    BACKFILL_MAX_CONCURRENCY,
    BACKFILL_RETRY_BACKOFF_SECONDS,
    BACKFILL_RETRY_MAX_ATTEMPTS,
    BACKFILL_WORKER_POLL_INTERVAL_SECONDS,
)
from app.modules.batch_shared.jobs.interfaces import JobContext
from app.modules.historical_backfill.controller import HistoricalBackfillJobController
from app.modules.historical_backfill.fetcher import HistoricalFetcher
from app.modules.historical_backfill.job import HistoricalBackfillJobImplementation
from app.modules.historical_backfill.logging import (
    BackfillLogContext,
    get_backfill_logger,
    redact_secrets,
)
from app.modules.historical_backfill.metrics import BackfillMetrics
from app.modules.historical_backfill.repository import HistoricalBackfillJobRepository
from app.modules.historical_backfill.types import BackfillJobStatus


@dataclass
class HistoricalBackfillWorkerRuntime:
    session_factory: Callable[[], Session]
    max_concurrency: int = BACKFILL_MAX_CONCURRENCY
    retry_max_attempts: int = BACKFILL_RETRY_MAX_ATTEMPTS
    retry_backoff_seconds: float = float(BACKFILL_RETRY_BACKOFF_SECONDS)
    fetch_min_interval_seconds: float = float(BACKFILL_FETCH_MIN_INTERVAL_SECONDS)
    heartbeat_interval_seconds: float = float(BACKFILL_HEARTBEAT_INTERVAL_SECONDS)
    poll_interval_seconds: float = float(BACKFILL_WORKER_POLL_INTERVAL_SECONDS)
    logger_name: str = "historical_backfill_worker"
    metrics: BackfillMetrics = field(default_factory=BackfillMetrics)
    _stop_event: threading.Event = field(default_factory=threading.Event)

    def run_forever(self) -> None:
        logging.basicConfig(level=logging.INFO)
        self._install_signal_handlers()
        while not self._stop_event.is_set():
            self.run_once()
            self._stop_event.wait(self.poll_interval_seconds)

    def run_once(self) -> None:
        controller = HistoricalBackfillJobController(
            repository=HistoricalBackfillJobRepository(session_factory=self.session_factory)
        )
        active_jobs = controller.list_active()
        self.metrics.set_gauge("backfill_active_jobs", len(active_jobs))
        runnable = [
            job
            for job in active_jobs
            if job.status in {BackfillJobStatus.CREATED.value, BackfillJobStatus.RETRYING.value}
        ]
        if not runnable:
            return

        selected = runnable[: max(1, self.max_concurrency)]
        if len(selected) == 1:
            self._execute_job(selected[0].id)
            return

        with ThreadPoolExecutor(max_workers=len(selected)) as pool:
            futures = [pool.submit(self._execute_job, job.id) for job in selected]
            for future in futures:
                future.result()

    def stop(self) -> None:
        self._stop_event.set()

    def _install_signal_handlers(self) -> None:
        def _handle_signal(_signum: int, _frame: object) -> None:
            self.stop()

        signal.signal(signal.SIGINT, _handle_signal)
        signal.signal(signal.SIGTERM, _handle_signal)

    def _execute_job(self, job_id: int) -> None:
        controller = HistoricalBackfillJobController(
            repository=HistoricalBackfillJobRepository(session_factory=self.session_factory)
        )
        job = controller.get(job_id)
        if job is None:
            return

        logger = get_backfill_logger(
            self.logger_name,
            BackfillLogContext(
                job_id=job.id,
                job_type=job.job_type,
                code=job.code,
                chunk_cursor=job.checkpoint_cursor,
                status=BackfillJobStatus.RUNNING.value,
            ),
        )
        start = time.perf_counter()
        controller.mark_running(job.id)
        heartbeat_stop = threading.Event()

        def _heartbeat_loop() -> None:
            interval = max(1.0, self.heartbeat_interval_seconds / 2)
            while not heartbeat_stop.wait(interval):
                controller.update_progress(job.id)

        heartbeat_thread = threading.Thread(target=_heartbeat_loop, daemon=True)
        heartbeat_thread.start()
        context = JobContext(job_id=job.id, job_type=job.job_type)

        def update_progress(
            rows_processed: int | None = None,
            *,
            rows_written: int | None = None,
            rows_failed_validation: int | None = None,
            rows_skipped_conflict: int | None = None,
            checkpoint_cursor: str | None = None,
            processed_chunks: int | None = None,
            total_chunks: int | None = None,
        ) -> None:
            controller.update_progress(
                job.id,
                rows_processed=rows_processed,
                rows_written=rows_written,
                rows_failed_validation=rows_failed_validation,
                rows_skipped_conflict=rows_skipped_conflict,
                checkpoint_cursor=checkpoint_cursor,
                processed_chunks=processed_chunks,
                total_chunks=total_chunks,
            )

        def on_chunk_retry(*, chunk_cursor: str, attempt: int) -> None:
            controller.mark_retrying(job.id, retry_count=attempt)
            self.metrics.inc("backfill_chunk_retry_total", 1)
            retry_logger = get_backfill_logger(
                self.logger_name,
                BackfillLogContext(
                    job_id=job.id,
                    job_type=job.job_type,
                    code=job.code,
                    chunk_cursor=chunk_cursor,
                    status=BackfillJobStatus.RETRYING.value,
                ),
            )
            retry_logger.warning("chunk retry", extra={"attempt": attempt})

        context.update_progress = update_progress  # type: ignore[assignment]
        context.on_chunk_retry = on_chunk_retry  # type: ignore[attr-defined]

        implementation = HistoricalBackfillJobImplementation(
            session_factory=self.session_factory,
            fetcher=HistoricalFetcher(min_interval_seconds=self.fetch_min_interval_seconds),
            retry_max_attempts=self.retry_max_attempts,
            retry_backoff_seconds=self.retry_backoff_seconds,
            heartbeat_interval_seconds=self.heartbeat_interval_seconds,
        )

        try:
            result = implementation.execute(
                {
                    "code": job.code,
                    "start_date": job.requested_start_date.isoformat(),
                    "end_date": job.requested_end_date.isoformat(),
                    "overwrite_mode": job.overwrite_mode,
                    "checkpoint_cursor": job.checkpoint_cursor,
                },
                context=context,
            )
            controller.mark_completed(
                job.id,
                rows_processed=result.normalized_rows_processed,
                rows_written=result.rows_written or 0,
            )
            self.metrics.inc("backfill_rows_processed_total", result.normalized_rows_processed)
            self.metrics.set_gauge("backfill_job_duration_seconds", time.perf_counter() - start)
            logger.info(
                "job completed",
                extra={"elapsed_ms": int((time.perf_counter() - start) * 1000)},
            )
        except Exception as err:
            self.metrics.inc("backfill_job_failure_count", 1)
            message = redact_secrets(str(err))
            controller.mark_failed(job.id, error_message=message)
            logger.error(
                "job failed",
                extra={
                    "status": BackfillJobStatus.FAILED.value,
                    "elapsed_ms": int((time.perf_counter() - start) * 1000),
                    "error_message": message,
                },
            )
            raise
        finally:
            heartbeat_stop.set()
            heartbeat_thread.join(timeout=1)
            self.metrics.set_gauge(
                "backfill_active_jobs",
                len(
                    [
                        active
                        for active in controller.list_active()
                        if active.status
                        in {
                            BackfillJobStatus.CREATED.value,
                            BackfillJobStatus.RUNNING.value,
                            BackfillJobStatus.RETRYING.value,
                        }
                    ]
                ),
            )
