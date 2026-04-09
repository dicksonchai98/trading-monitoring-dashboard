"""Admin-only route group."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.deps import Principal, require_admin
from app.state import audit_log

router = APIRouter(prefix="/api/admin", tags=["admin"])


class SeedAuditLogsRequest(BaseModel):
    count: int = Field(default=6, ge=1, le=200)
    clear_before: bool = False


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


@router.post("/logs/seed")
def seed_logs(
    payload: SeedAuditLogsRequest,
    principal: Principal = Depends(require_admin),
) -> dict[str, int]:
    if payload.clear_before:
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
    return {"seeded": payload.count, "total": len(audit_log.events)}


@router.get("/logs/{item_id}")
def logs_detail(item_id: str, _: Principal = Depends(require_admin)) -> dict[str, str]:
    return {"id": item_id}
