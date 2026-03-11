"""Shared types for historical backfill."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class BackfillJobStatus(str, Enum):
    CREATED = "created"
    RUNNING = "running"
    RETRYING = "retrying"
    FAILED = "failed"
    COMPLETED = "completed"


ACTIVE_BACKFILL_STATUSES = {
    BackfillJobStatus.CREATED.value,
    BackfillJobStatus.RUNNING.value,
    BackfillJobStatus.RETRYING.value,
}


@dataclass(frozen=True)
class BackfillProgress:
    rows_processed: int = 0
    rows_written: int = 0
    rows_failed_validation: int = 0
    rows_skipped_conflict: int = 0
    processed_chunks: int = 0
    total_chunks: int | None = None
    checkpoint_cursor: str | None = None
    last_heartbeat_at: datetime | None = None
