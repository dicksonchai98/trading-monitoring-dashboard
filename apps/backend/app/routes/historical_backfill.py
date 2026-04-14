"""Admin historical backfill APIs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.config import REDIS_URL
from app.deps import Principal, require_admin
from app.modules.batch_shared.queue.redis_queue import RedisBatchQueue
from app.modules.batch_shared.repositories.job_repository import JobRepository
from app.modules.batch_shared.services.admin_jobs import BatchJobAdminService
from app.modules.historical_backfill.schemas import (
    HistoricalBackfillDetailResponse,
    HistoricalBackfillListResponse,
    HistoricalBackfillTriggerRequest,
    HistoricalBackfillTriggerResponse,
)
from app.modules.historical_backfill.service import HistoricalBackfillService
from app.state import audit_log

router = APIRouter(prefix="/api/admin/batch/backfill", tags=["historical-backfill"])


def _build_queue() -> RedisBatchQueue:
    try:
        import redis
    except ImportError as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("redis package is required for batch admin queue operations") from err
    return RedisBatchQueue(client=redis.Redis.from_url(REDIS_URL, decode_responses=True))


def _service() -> HistoricalBackfillService:
    queue = _build_queue()
    return HistoricalBackfillService(
        repository=JobRepository(),
        batch_admin_service=BatchJobAdminService(repository=JobRepository(), queue=queue),
        audit_log=audit_log,
    )


@router.post("/jobs", response_model=HistoricalBackfillTriggerResponse, status_code=202)
def trigger_historical_job(
    payload: HistoricalBackfillTriggerRequest,
    principal: Principal = Depends(require_admin),
) -> HistoricalBackfillTriggerResponse:
    service = _service()
    try:
        return service.trigger(payload, actor=principal.username)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err


@router.get("/jobs/{job_id}", response_model=HistoricalBackfillDetailResponse)
def get_historical_job(
    job_id: int,
    _: Principal = Depends(require_admin),
) -> HistoricalBackfillDetailResponse:
    service = _service()
    result = service.get(job_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job_not_found")
    return result


@router.get("/jobs", response_model=HistoricalBackfillListResponse)
def list_historical_jobs(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: Principal = Depends(require_admin),
) -> HistoricalBackfillListResponse:
    service = _service()
    return service.list(status=status_filter, limit=limit, offset=offset)
