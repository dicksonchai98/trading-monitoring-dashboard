"""Admin-only route group."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.db.session import SessionLocal
from app.deps import Principal, require_admin
from app.modules.batch_data.market_crawler.repositories.crawler_job_repository import (
    CrawlerJobRepository,
)
from app.state import audit_log

router = APIRouter(prefix="/admin", tags=["admin"])


class CrawlerRunRequest(BaseModel):
    dataset_code: str = Field(..., min_length=1)
    target_date: date
    trigger_type: str = Field("manual", min_length=1)


class CrawlerBackfillRequest(BaseModel):
    dataset_code: str = Field(..., min_length=1)
    start_date: date
    end_date: date
    trigger_type: str = Field("manual", min_length=1)


def _serialize_job(job: object) -> dict[str, object]:
    return {
        "id": job.id,
        "parent_job_id": job.parent_job_id,
        "correlation_id": job.correlation_id,
        "dataset_code": job.dataset_code,
        "target_date": job.target_date,
        "range_start": job.range_start,
        "range_end": job.range_end,
        "trigger_type": job.trigger_type,
        "status": job.status,
        "retry_count": job.retry_count,
        "rows_fetched": job.rows_fetched,
        "rows_normalized": job.rows_normalized,
        "rows_persisted": job.rows_persisted,
        "error_category": job.error_category,
        "error_stage": job.error_stage,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }


@router.get("/logs")
def logs(
    _: Principal = Depends(require_admin),
) -> dict[str, list[dict[str, str | int | float | bool | None | dict[str, object]]]]:
    return {
        "events": [
            {
                "event_type": event.event_type,
                "path": event.path,
                "actor": event.actor,
                "role": event.role,
                "timestamp": event.timestamp,
                "metadata": event.metadata,
            }
            for event in audit_log.events
        ]
    }


@router.get("/logs/{item_id}")
def logs_detail(item_id: str, _: Principal = Depends(require_admin)) -> dict[str, str]:
    return {"id": item_id}


@router.post("/crawler/run")
def run_crawler(
    request: Request,
    payload: CrawlerRunRequest,
    principal: Principal = Depends(require_admin),
) -> dict[str, object]:
    repo = CrawlerJobRepository(session_factory=SessionLocal)
    job_id = repo.create_child_job(
        dataset_code=payload.dataset_code,
        target_date=payload.target_date,
        trigger_type=payload.trigger_type,
        parent_job_id=None,
        correlation_id=None,
    )
    audit_log.record(
        event_type="crawler_run_triggered",
        path=request.url.path,
        actor=principal.username,
        role=principal.role,
    )
    return {"job_id": job_id, "status": "CREATED"}


@router.post("/crawler/backfill")
def backfill_crawler(
    request: Request,
    payload: CrawlerBackfillRequest,
    principal: Principal = Depends(require_admin),
) -> dict[str, object]:
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_date_range")
    repo = CrawlerJobRepository(session_factory=SessionLocal)
    parent_id, correlation_id = repo.create_parent_range_job(
        dataset_code=payload.dataset_code,
        start_date=payload.start_date,
        end_date=payload.end_date,
        trigger_type=payload.trigger_type,
    )
    cursor = payload.start_date
    while cursor <= payload.end_date:
        repo.create_child_job(
            dataset_code=payload.dataset_code,
            target_date=cursor,
            trigger_type=payload.trigger_type,
            parent_job_id=parent_id,
            correlation_id=correlation_id,
        )
        cursor = cursor.fromordinal(cursor.toordinal() + 1)
    audit_log.record(
        event_type="crawler_backfill_triggered",
        path=request.url.path,
        actor=principal.username,
        role=principal.role,
    )
    return {"parent_job_id": parent_id, "correlation_id": correlation_id, "status": "CREATED"}


@router.get("/crawler/jobs")
def list_crawler_jobs(
    dataset_code: str | None = None,
    _: Principal = Depends(require_admin),
) -> dict[str, list[dict[str, object]]]:
    repo = CrawlerJobRepository(session_factory=SessionLocal)
    jobs = repo.list_jobs(dataset_code=dataset_code)
    return {"items": [_serialize_job(job) for job in jobs]}


@router.get("/crawler/jobs/{job_id}")
def get_crawler_job(
    job_id: int,
    _: Principal = Depends(require_admin),
) -> dict[str, object]:
    repo = CrawlerJobRepository(session_factory=SessionLocal)
    job = repo.get(job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job_not_found")
    return _serialize_job(job)
