"""Admin-only route group."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.deps import Principal, require_admin
from app.state import audit_event_repository

router = APIRouter(prefix="/api/admin", tags=["admin"])


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


@router.get("/logs/{item_id}")
def logs_detail(item_id: str, _: Principal = Depends(require_admin)) -> dict[str, str]:
    return {"id": item_id}
