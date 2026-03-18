"""Shared admin APIs for batch jobs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import Principal, require_admin
from app.modules.batch_shared.repositories.job_repository import JobRepository
from app.modules.batch_shared.schemas.admin_jobs import (
    BatchJobListResponse,
    BatchJobSummaryResponse,
)

router = APIRouter(prefix="/api/admin/batch", tags=["batch-jobs"])


def _to_summary(job) -> BatchJobSummaryResponse:
    return BatchJobSummaryResponse(
        job_id=job.id,
        worker_type=job.worker_type,
        job_type=job.job_type,
        status=job.status,
        retry_count=job.retry_count,
        rows_processed=job.rows_processed,
        checkpoint_cursor=job.checkpoint_cursor,
        processed_chunks=job.processed_chunks,
        total_chunks=job.total_chunks,
        error_message=job.error_message,
        created_at=job.created_at.isoformat(),
        started_at=job.started_at.isoformat() if job.started_at else None,
        finished_at=job.finished_at.isoformat() if job.finished_at else None,
        metadata=job.metadata_json,
    )


@router.get("/jobs", response_model=BatchJobListResponse)
def list_batch_jobs(
    worker_type: str | None = Query(default=None),
    job_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: Principal = Depends(require_admin),
) -> BatchJobListResponse:
    repo = JobRepository()
    items, total = repo.list_jobs_filtered(
        worker_type=worker_type,
        job_type=job_type,
        status=status_filter,
        limit=limit,
        offset=offset,
    )
    return BatchJobListResponse(
        items=[_to_summary(item) for item in items],
        pagination={"limit": limit, "offset": offset, "total": total},
    )


@router.get("/jobs/{job_id}", response_model=BatchJobSummaryResponse)
def get_batch_job(job_id: int, _: Principal = Depends(require_admin)) -> BatchJobSummaryResponse:
    repo = JobRepository()
    job = repo.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job_not_found")
    return _to_summary(job)
