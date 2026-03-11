"""Batch job interfaces and models."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Protocol


class JobStatus(str, Enum):
    CREATED = "CREATED"
    RUNNING = "RUNNING"
    FAILED = "FAILED"
    COMPLETED = "COMPLETED"
    RETRYING = "RETRYING"
    PARTIALLY_COMPLETED = "PARTIALLY_COMPLETED"


@dataclass(frozen=True)
class JobResult:
    rows_processed: int | None = None
    rows_written: int | None = None

    @property
    def normalized_rows_processed(self) -> int:
        if self.rows_processed is not None:
            return self.rows_processed
        if self.rows_written is not None:
            return self.rows_written
        return 0


@dataclass
class JobContext:
    job_id: int
    job_type: str

    def update_progress(
        self,
        rows_processed: int | None = None,
        *,
        rows_written: int | None = None,
        checkpoint_cursor: str | None = None,
        processed_chunks: int | None = None,
        total_chunks: int | None = None,
        last_heartbeat_at: datetime | None = None,
    ) -> None:  # pragma: no cover - injected by runner
        _ = rows_processed
        _ = rows_written
        _ = checkpoint_cursor
        _ = processed_chunks
        _ = total_chunks
        _ = last_heartbeat_at
        raise NotImplementedError


class JobImplementation(Protocol):
    def execute(self, params: dict[str, object], context: JobContext) -> JobResult: ...
