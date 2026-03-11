"""Historical backfill job implementation."""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import date
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.modules.batch_shared.jobs.interfaces import JobContext, JobResult
from app.modules.historical_backfill.chunker import chunk_date_range
from app.modules.historical_backfill.errors import ErrorClass, classify_error
from app.modules.historical_backfill.fetcher import HistoricalFetcher
from app.modules.historical_backfill.logging import BackfillLogContext, get_backfill_logger
from app.modules.historical_backfill.transformer import transform_historical_rows
from app.modules.historical_backfill.writer import upsert_kbars


def _parse_date(raw: object, field: str) -> date:
    if not isinstance(raw, str):
        raise ValueError(f"invalid_{field}")
    try:
        return date.fromisoformat(raw)
    except ValueError as err:
        raise ValueError(f"invalid_{field}") from err


@dataclass
class HistoricalBackfillJobImplementation:
    session_factory: Callable[[], Session]
    fetcher: HistoricalFetcher
    retry_max_attempts: int = 3
    retry_backoff_seconds: float = 1.0
    logger_name: str = "historical_backfill"
    heartbeat_interval_seconds: float = 30.0

    def execute(self, params: dict[str, Any], context: JobContext) -> JobResult:
        code = str(params.get("code", "")).strip()
        if not code:
            raise ValueError("invalid_code")
        start_date = _parse_date(params.get("start_date"), "start_date")
        end_date = _parse_date(params.get("end_date"), "end_date")
        overwrite_mode = str(params.get("overwrite_mode", "closed_only"))
        if overwrite_mode not in {"closed_only", "force"}:
            raise ValueError("invalid_overwrite_mode")

        chunks = chunk_date_range(start_date, end_date)
        total_chunks = len(chunks)
        checkpoint = params.get("checkpoint_cursor")
        resume_index = 0
        if isinstance(checkpoint, str) and checkpoint:
            for idx, (chunk_start, _chunk_end) in enumerate(chunks):
                if chunk_start.isoformat() <= checkpoint:
                    resume_index = idx + 1

        rows_processed = 0
        rows_written = 0
        rows_failed_validation = 0
        rows_skipped_conflict = 0
        processed_chunks = resume_index

        self._update_progress(
            context,
            rows_processed=rows_processed,
            rows_written=rows_written,
            rows_failed_validation=rows_failed_validation,
            rows_skipped_conflict=rows_skipped_conflict,
            processed_chunks=processed_chunks,
            total_chunks=total_chunks,
            checkpoint_cursor=checkpoint if isinstance(checkpoint, str) else None,
        )

        last_heartbeat = time.monotonic()

        for index in range(resume_index, total_chunks):
            chunk_start, chunk_end = chunks[index]
            chunk_cursor = chunk_end.isoformat()
            logger = get_backfill_logger(
                self.logger_name,
                BackfillLogContext(
                    job_id=context.job_id,
                    job_type="historical_backfill",
                    code=code,
                    chunk_cursor=chunk_cursor,
                    status="running",
                ),
            )
            chunk_start_time = time.perf_counter()
            try:
                raw_rows = self.fetcher.fetch_bars(
                    code=code, start_date=chunk_start, end_date=chunk_end
                )
                transformed = transform_historical_rows(code=code, rows=raw_rows)
                with self.session_factory() as session, session.begin():
                    write_result = upsert_kbars(
                        session, transformed.valid_rows, overwrite_mode=overwrite_mode
                    )
            except Exception as err:
                err_class = classify_error(err)
                logger.error(
                    "chunk failed",
                    extra={
                        "error_class": err_class.value,
                        "error_message": str(err),
                    },
                )
                raise

            rows_processed += len(transformed.valid_rows) + transformed.invalid_count
            rows_written += write_result.rows_written
            rows_failed_validation += transformed.invalid_count
            rows_skipped_conflict += write_result.rows_skipped_conflict
            processed_chunks = index + 1
            self._update_progress(
                context,
                rows_processed=rows_processed,
                rows_written=rows_written,
                rows_failed_validation=rows_failed_validation,
                rows_skipped_conflict=rows_skipped_conflict,
                checkpoint_cursor=chunk_cursor,
                processed_chunks=processed_chunks,
                total_chunks=total_chunks,
            )
            elapsed_ms = int((time.perf_counter() - chunk_start_time) * 1000)
            logger.info(
                "chunk completed",
                extra={
                    "elapsed_ms": elapsed_ms,
                    "status": "completed",
                },
            )

            now = time.monotonic()
            if now - last_heartbeat >= self.heartbeat_interval_seconds:
                self._update_progress(
                    context,
                    rows_processed=rows_processed,
                    rows_written=rows_written,
                    rows_failed_validation=rows_failed_validation,
                    rows_skipped_conflict=rows_skipped_conflict,
                    checkpoint_cursor=chunk_cursor,
                    processed_chunks=processed_chunks,
                    total_chunks=total_chunks,
                )
                last_heartbeat = now

        return JobResult(rows_processed=rows_processed, rows_written=rows_written)

    def _update_progress(self, context: JobContext, **kwargs: Any) -> None:
        try:
            context.update_progress(**kwargs)  # type: ignore[misc]
        except TypeError:
            supported = {
                "rows_processed": kwargs.get("rows_processed"),
                "rows_written": kwargs.get("rows_written"),
                "checkpoint_cursor": kwargs.get("checkpoint_cursor"),
                "processed_chunks": kwargs.get("processed_chunks"),
                "total_chunks": kwargs.get("total_chunks"),
            }
            context.update_progress(**supported)
