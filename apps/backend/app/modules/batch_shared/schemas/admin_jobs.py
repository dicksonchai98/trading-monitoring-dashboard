"""Schemas for shared admin batch job APIs."""

from __future__ import annotations

from pydantic import BaseModel


class BatchJobSummaryResponse(BaseModel):
    job_id: int
    worker_type: str
    job_type: str
    status: str
    retry_count: int
    rows_processed: int
    checkpoint_cursor: str | None
    processed_chunks: int
    total_chunks: int | None
    error_message: str | None
    created_at: str
    started_at: str | None
    finished_at: str | None
    metadata: dict | None


class BatchJobListResponse(BaseModel):
    items: list[BatchJobSummaryResponse]
    pagination: dict[str, int]
