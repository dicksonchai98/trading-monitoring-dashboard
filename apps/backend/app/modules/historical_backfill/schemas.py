"""Pydantic schemas for historical backfill API."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class HistoricalBackfillTriggerRequest(BaseModel):
    code: str = Field(min_length=1, max_length=16)
    start_date: date
    end_date: date
    overwrite_mode: str = Field(default="closed_only")


class HistoricalBackfillTriggerResponse(BaseModel):
    job_id: int
    status: str


class HistoricalBackfillDetailResponse(BaseModel):
    job_id: int
    status: str
    code: str
    requested_start_date: date
    requested_end_date: date
    overwrite_mode: str
    rows_written: int
    rows_processed: int
    rows_failed_validation: int
    rows_skipped_conflict: int
    retry_count: int
    processed_chunks: int
    total_chunks: int | None
    checkpoint_cursor: str | None
    error_message: str | None
    created_at: str
    started_at: str | None
    finished_at: str | None
    last_heartbeat_at: str | None


class HistoricalBackfillListResponse(BaseModel):
    items: list[HistoricalBackfillDetailResponse]
    pagination: dict[str, int]
