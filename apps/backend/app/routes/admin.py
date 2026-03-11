"""Admin-only route group."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import Principal, require_admin
from app.state import audit_log

router = APIRouter(prefix="/admin", tags=["admin"])


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
