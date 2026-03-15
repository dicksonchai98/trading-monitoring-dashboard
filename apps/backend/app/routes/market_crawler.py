"""Market crawler admin routes."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.deps import Principal, require_admin
from app.modules.batch_data.market_crawler.services.admin_jobs import MarketCrawlerAdminJobService
from app.modules.batch_shared.queue.redis_queue import RedisBatchQueue
from app.modules.batch_shared.repositories.job_repository import JobRepository
from app.modules.batch_shared.services.admin_jobs import BatchJobAdminService
from app.state import audit_log

router = APIRouter(prefix="/api/admin/batch/crawler", tags=["market-crawler"])


class CrawlerRunRequest(BaseModel):
    dataset_code: str = Field(..., min_length=1)
    target_date: date
    trigger_type: str = Field("manual", min_length=1)


class CrawlerBackfillRequest(BaseModel):
    dataset_code: str = Field(..., min_length=1)
    start_date: date
    end_date: date
    trigger_type: str = Field("manual", min_length=1)


def _build_queue() -> RedisBatchQueue:
    try:
        import redis
    except ImportError as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("redis package is required for batch admin queue operations") from err
    return RedisBatchQueue(client=redis.Redis(decode_responses=True))


def _crawler_service() -> MarketCrawlerAdminJobService:
    queue = _build_queue()
    repository = JobRepository()
    batch_admin_service = BatchJobAdminService(repository=repository, queue=queue)
    return MarketCrawlerAdminJobService(
        repository=repository,
        batch_admin_service=batch_admin_service,
    )


@router.post("/jobs", status_code=202)
def create_crawler_job(
    request: Request,
    payload: CrawlerRunRequest | CrawlerBackfillRequest,
    principal: Principal = Depends(require_admin),
) -> dict[str, object]:
    service = _crawler_service()
    if isinstance(payload, CrawlerBackfillRequest):
        if payload.end_date < payload.start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_date_range"
            )
        result = service.create_backfill_job(
            dataset_code=payload.dataset_code,
            start_date=payload.start_date,
            end_date=payload.end_date,
            trigger_type=payload.trigger_type,
        )
        event_type = "crawler_backfill_triggered"
    else:
        result = service.create_single_date_job(
            dataset_code=payload.dataset_code,
            target_date=payload.target_date,
            trigger_type=payload.trigger_type,
        )
        event_type = "crawler_run_triggered"
    audit_log.record(
        event_type=event_type,
        path=request.url.path,
        actor=principal.username,
        role=principal.role,
    )
    return {
        "job_id": result.job_id,
        "worker_type": result.worker_type,
        "job_type": result.job_type,
        "status": result.status,
    }
