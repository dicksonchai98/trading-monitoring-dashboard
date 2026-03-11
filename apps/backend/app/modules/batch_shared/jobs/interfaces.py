"""Batch job interfaces and models."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Protocol


class JobStatus(str, Enum):
    CREATED = "CREATED"
    RUNNING = "RUNNING"
    FAILED = "FAILED"
    COMPLETED = "COMPLETED"
    RETRYING = "RETRYING"


@dataclass(frozen=True)
class JobResult:
    rows_processed: int = 0


@dataclass
class JobContext:
    job_id: int
    job_type: str

    def update_progress(self, rows_processed: int) -> None:  # pragma: no cover - injected by runner
        _ = rows_processed
        raise NotImplementedError


class JobImplementation(Protocol):
    def execute(self, params: dict[str, object], context: JobContext) -> JobResult: ...
