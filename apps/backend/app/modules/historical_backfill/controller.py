"""Job controller for historical backfill lifecycle transitions."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.modules.historical_backfill.repository import (
    BackfillCreateRequest,
    HistoricalBackfillJobRepository,
)


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


@dataclass
class HistoricalBackfillJobController:
    repository: HistoricalBackfillJobRepository

    def get(self, job_id: int):
        return self.repository.get(job_id)

    def list_active(self):
        return self.repository.list_active()

    def create_or_get(self, req: BackfillCreateRequest):
        return self.repository.create_or_get_active(req)

    def mark_running(self, job_id: int) -> None:
        self.repository.mark_running(job_id)

    def mark_retrying(self, job_id: int, retry_count: int) -> None:
        self.repository.mark_retrying(job_id, retry_count)

    def mark_completed(self, job_id: int, *, rows_processed: int, rows_written: int) -> None:
        self.repository.mark_completed(
            job_id, rows_processed=rows_processed, rows_written=rows_written
        )

    def mark_failed(self, job_id: int, error_message: str) -> None:
        self.repository.mark_failed(job_id, error_message=error_message)

    def update_progress(
        self,
        job_id: int,
        *,
        rows_processed: int | None = None,
        rows_written: int | None = None,
        rows_failed_validation: int | None = None,
        rows_skipped_conflict: int | None = None,
        processed_chunks: int | None = None,
        total_chunks: int | None = None,
        checkpoint_cursor: str | None = None,
    ) -> None:
        self.repository.update_progress(
            job_id,
            rows_processed=rows_processed,
            rows_written=rows_written,
            rows_failed_validation=rows_failed_validation,
            rows_skipped_conflict=rows_skipped_conflict,
            processed_chunks=processed_chunks,
            total_chunks=total_chunks,
            checkpoint_cursor=checkpoint_cursor,
            heartbeat_at=_utcnow(),
        )
