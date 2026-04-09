"""Admin-only route group."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.deps import Principal, require_admin
from app.state import audit_event_repository, audit_log

router = APIRouter(prefix="/api/admin", tags=["admin"])


class SeedAuditLogsRequest(BaseModel):
    count: int = Field(default=6, ge=1, le=200)
    clear_before: bool = False


class AuditEventItem(BaseModel):
    id: int
    event_type: str
    path: str
    actor: str | None
    role: str | None
    result: str | None
    timestamp: str
    metadata: dict[str, object]


class AuditLogsResponse(BaseModel):
    items: list[AuditEventItem]
    pagination: dict[str, int]
    events: list[AuditEventItem] | None = None


@router.get("/logs")
def logs(
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
    event_type: str | None = None,
    actor: str | None = None,
    path: str | None = None,
    result: str | None = Query(default=None, pattern="^(success|accepted|denied|error|unknown)$"),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: Principal = Depends(require_admin),
) -> AuditLogsResponse:
    items, total = audit_event_repository.query(
        from_ts=from_ts,
        to_ts=to_ts,
        event_type=event_type,
        actor=actor,
        path=path,
        result=result,
        limit=limit,
        offset=offset,
    )
    response_items = [
        AuditEventItem(
            id=item.id,
            event_type=item.event_type,
            path=item.path,
            actor=item.actor,
            role=item.role,
            result=item.result,
            timestamp=item.created_at.isoformat(),
            metadata=item.metadata,
        )
        for item in items
    ]
    return AuditLogsResponse(
        items=response_items,
        pagination={"limit": limit, "offset": offset, "total": total},
        events=response_items,
    )


@router.post("/logs/seed")
def seed_logs(
    payload: SeedAuditLogsRequest,
    principal: Principal = Depends(require_admin),
) -> dict[str, int]:
    if payload.clear_before:
        audit_event_repository.delete_all()
        audit_log.events.clear()
    templates: list[tuple[str, str, dict[str, object] | None]] = [
        ("admin_access_denied", "/api/admin/batch/jobs", {"reason": "insufficient_role"}),
        (
            "crawler_run_triggered",
            "/api/admin/batch/crawler/jobs",
            {"job_id": 12001, "dataset_code": "taifex_institution_open_interest_daily"},
        ),
        (
            "crawler_backfill_triggered",
            "/api/admin/batch/crawler/jobs",
            {"job_id": 12002, "start_date": "2026-04-01", "end_date": "2026-04-09"},
        ),
        (
            "historical_backfill_triggered",
            "/api/admin/batch/backfill/jobs",
            {"job_id": 3301, "request_payload_hash": "a19f22c818b9cdef"},
        ),
        (
            "subscription_status_changed",
            "/billing/webhooks/stripe",
            {"subscription_id": "sub_demo_001", "status": "active"},
        ),
    ]
    for idx in range(payload.count):
        event_type, path, metadata = templates[idx % len(templates)]
        event_metadata = dict(metadata) if isinstance(metadata, dict) else None
        if event_metadata is not None:
            event_metadata["seed_index"] = idx + 1
        audit_log.record(
            event_type=event_type,
            path=path,
            actor=principal.username,
            role=principal.role,
            metadata=event_metadata,
        )
    return {"seeded": payload.count, "total": audit_event_repository.count()}


@router.get("/logs/{item_id}")
def logs_detail(item_id: str, _: Principal = Depends(require_admin)) -> dict[str, str]:
    return {"id": item_id}
