"""Analytics route group."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.deps import get_db_session
from app.deps import Principal, require_user_or_admin
from app.modules.kbar_analytics.service import KbarAnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


class AnalyticsJobRequest(BaseModel):
    code: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    event_ids: list[str] | None = None
    metric_ids: list[str] | None = None


class EventSamplesResponse(BaseModel):
    items: list[dict[str, Any]]
    pagination: dict[str, int]


@router.get("/history")
def history(_: Principal = Depends(require_user_or_admin)) -> dict[str, list[dict[str, str]]]:
    return {"items": [{"timestamp": "now", "value": "mock"}]}


@router.get("/events")
def list_events(
    _: Principal = Depends(require_user_or_admin),
    session: Session = Depends(get_db_session),
) -> dict[str, list[dict[str, Any]]]:
    service = KbarAnalyticsService(session)
    return {"items": service.list_events()}


@router.get("/metrics")
def list_metrics(
    _: Principal = Depends(require_user_or_admin),
    session: Session = Depends(get_db_session),
) -> dict[str, list[dict[str, str]]]:
    service = KbarAnalyticsService(session)
    return {"items": service.list_metrics()}


@router.get("/events/{event_id}/stats")
def event_stats(
    event_id: str,
    code: str,
    start_date: date | None = None,
    end_date: date | None = None,
    version: str = "latest",
    _: Principal = Depends(require_user_or_admin),
    session: Session = Depends(get_db_session),
) -> dict[str, Any]:
    parsed_version: int | None = None
    if version != "latest":
        try:
            parsed_version = int(version)
        except ValueError as err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_version"
            ) from err
    service = KbarAnalyticsService(session)

    def _to_item(entity: Any) -> dict[str, Any]:
        return {
            "event_id": entity.event_id,
            "code": entity.code,
            "start_date": entity.start_date.isoformat(),
            "end_date": entity.end_date.isoformat(),
            "sample_count": entity.sample_count,
            "up_count": entity.up_count,
            "down_count": entity.down_count,
            "flat_count": entity.flat_count,
            "up_probability": entity.up_probability,
            "down_probability": entity.down_probability,
            "flat_probability": entity.flat_probability,
            "avg_next_day_return": entity.avg_next_day_return,
            "median_next_day_return": entity.median_next_day_return,
            "avg_next_day_range": entity.avg_next_day_range,
            "avg_next_day_gap": entity.avg_next_day_gap,
            "version": entity.version,
        }

    if event_id == "all":
        if version != "latest":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_version")
        items = service.get_latest_event_stats_by_code(code=code)
        return {"items": [_to_item(entity) for entity in items]}

    if start_date is None or end_date is None:
        entity = service.get_latest_event_stats(
            event_id=event_id,
            code=code,
            version=parsed_version,
        )
        if entity is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="event_stats_not_found",
            )
        return _to_item(entity)

    try:
        entity = service.get_event_stats(
            event_id=event_id,
            code=code,
            start_date=start_date,
            end_date=end_date,
            version=parsed_version,
        )
    except KeyError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="event_not_found"
        ) from err
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="event_stats_not_found")
    return _to_item(entity)


@router.get("/events/{event_id}/samples", response_model=EventSamplesResponse)
def event_samples(
    event_id: str,
    code: str,
    start_date: date,
    end_date: date,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    sort: str = Query(default="-trade_date"),
    _: Principal = Depends(require_user_or_admin),
    session: Session = Depends(get_db_session),
) -> EventSamplesResponse:
    if sort not in {"trade_date", "-trade_date"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_sort")
    service = KbarAnalyticsService(session)
    try:
        items, total = service.get_event_samples(
            event_id=event_id,
            code=code,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size,
            sort=sort,
        )
    except KeyError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="event_not_found"
        ) from err
    return EventSamplesResponse(
        items=[
            {
                "event_id": item.event_id,
                "code": item.code,
                "trade_date": item.trade_date.isoformat(),
                "next_trade_date": item.next_trade_date.isoformat(),
                "event_value": item.event_value,
                "event_day_return": item.event_day_return,
                "event_day_range": item.event_day_range,
                "next_day_return": item.next_day_return,
                "next_day_range": item.next_day_range,
                "next_day_gap": item.next_day_gap,
                "next_day_category": item.next_day_category,
            }
            for item in items
        ],
        pagination={"page": page, "page_size": page_size, "total": total},
    )


@router.get("/distributions/{metric_id}")
def distribution_stats(
    metric_id: str,
    code: str,
    start_date: date | None = None,
    end_date: date | None = None,
    version: str = "latest",
    _: Principal = Depends(require_user_or_admin),
    session: Session = Depends(get_db_session),
) -> dict[str, Any]:
    parsed_version: int | None = None
    if version != "latest":
        try:
            parsed_version = int(version)
        except ValueError as err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_version"
            ) from err
    service = KbarAnalyticsService(session)
    try:
        entity = service.get_distribution_stats(
            metric_id=metric_id,
            code=code,
            start_date=start_date,
            end_date=end_date,
            version=parsed_version,
        )
    except KeyError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="metric_not_found"
        ) from err
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="distribution_not_found")
    return {
        "metric_id": entity.metric_id,
        "code": entity.code,
        "start_date": entity.start_date.isoformat(),
        "end_date": entity.end_date.isoformat(),
        "sample_count": entity.sample_count,
        "mean": entity.mean,
        "median": entity.median,
        "min": entity.min,
        "max": entity.max,
        "p25": entity.p25,
        "p50": entity.p50,
        "p75": entity.p75,
        "p90": entity.p90,
        "p95": entity.p95,
        "histogram_json": entity.histogram_json,
        "version": entity.version,
    }


def _validate_job_range(payload: AnalyticsJobRequest) -> None:
    if payload.start_date and payload.end_date and payload.start_date > payload.end_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_date_range")


@router.post("/jobs/rebuild-daily-features", status_code=202)
def rebuild_daily_features(
    payload: AnalyticsJobRequest,
    _: Principal = Depends(require_user_or_admin),
    session: Session = Depends(get_db_session),
) -> dict[str, Any]:
    _validate_job_range(payload)
    service = KbarAnalyticsService(session)
    job = service.create_job(
        job_type="rebuild_daily_features",
        payload=payload.model_dump(mode="json", exclude_none=True),
    )
    try:
        result = service.execute_job_with_retry(
            job=job,
            operation=lambda: service.rebuild_daily_features(
                code=payload.code,
                start_date=payload.start_date,
                end_date=payload.end_date,
            ),
        )
        session.commit()
        return {"job_id": job.job_id, "status": job.status, "result": result}
    except Exception as err:
        session.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err


@router.post("/jobs/recompute-event-stats", status_code=202)
def recompute_event_stats(
    payload: AnalyticsJobRequest,
    _: Principal = Depends(require_user_or_admin),
    session: Session = Depends(get_db_session),
) -> dict[str, Any]:
    _validate_job_range(payload)
    if not payload.code or payload.start_date is None or payload.end_date is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="missing_required_params"
        )
    service = KbarAnalyticsService(session)
    job = service.create_job(
        job_type="recompute_event_stats", payload=payload.model_dump(mode="json", exclude_none=True)
    )
    try:
        result = service.execute_job_with_retry(
            job=job,
            operation=lambda: service.recompute_event_stats(
                code=payload.code,
                start_date=payload.start_date,
                end_date=payload.end_date,
                event_ids=payload.event_ids,
            ),
        )
        session.commit()
        return {"job_id": job.job_id, "status": job.status, "result": result}
    except KeyError as err:
        session.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err
    except Exception as err:
        session.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err


@router.post("/jobs/recompute-distribution-stats", status_code=202)
def recompute_distribution_stats(
    payload: AnalyticsJobRequest,
    _: Principal = Depends(require_user_or_admin),
    session: Session = Depends(get_db_session),
) -> dict[str, Any]:
    _validate_job_range(payload)
    if not payload.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="missing_required_params"
        )
    service = KbarAnalyticsService(session)
    job = service.create_job(
        job_type="recompute_distribution_stats",
        payload=payload.model_dump(mode="json", exclude_none=True),
    )
    try:
        result = service.execute_job_with_retry(
            job=job,
            operation=lambda: service.recompute_distribution_stats(
                code=payload.code,
                start_date=payload.start_date,
                end_date=payload.end_date,
                metric_ids=payload.metric_ids,
            ),
        )
        session.commit()
        return {"job_id": job.job_id, "status": job.status, "result": result}
    except KeyError as err:
        session.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err
    except Exception as err:
        session.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
