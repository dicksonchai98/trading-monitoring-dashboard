"""Admin historical backfill APIs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db.session import SessionLocal
from app.deps import Principal, require_admin
from app.modules.historical_backfill.repository import HistoricalBackfillJobRepository
from app.modules.historical_backfill.schemas import (
    HistoricalBackfillDetailResponse,
    HistoricalBackfillListResponse,
    HistoricalBackfillTriggerRequest,
    HistoricalBackfillTriggerResponse,
)
from app.modules.historical_backfill.service import HistoricalBackfillService
from app.state import audit_log

router = APIRouter(prefix="/api/admin/backfill", tags=["historical-backfill"])


def _service() -> HistoricalBackfillService:
    return HistoricalBackfillService(
        repository=HistoricalBackfillJobRepository(session_factory=SessionLocal),
        audit_log=audit_log,
    )


@router.post("/historical-jobs", response_model=HistoricalBackfillTriggerResponse, status_code=202)
def trigger_historical_job(
    payload: HistoricalBackfillTriggerRequest,
    principal: Principal = Depends(require_admin),
) -> HistoricalBackfillTriggerResponse:
    service = _service()
    try:
        return service.trigger(payload, actor=principal.username)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err


@router.get("/historical-jobs/{job_id}", response_model=HistoricalBackfillDetailResponse)
def get_historical_job(
    job_id: int,
    _: Principal = Depends(require_admin),
) -> HistoricalBackfillDetailResponse:
    service = _service()
    result = service.get(job_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job_not_found")
    return result


@router.get("/historical-jobs", response_model=HistoricalBackfillListResponse)
def list_historical_jobs(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: Principal = Depends(require_admin),
) -> HistoricalBackfillListResponse:
    service = _service()
    return service.list(status=status_filter, limit=limit, offset=offset)
