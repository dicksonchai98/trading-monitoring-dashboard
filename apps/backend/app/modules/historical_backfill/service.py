"""Service layer for historical backfill job APIs."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

from app.modules.historical_backfill.repository import (
    BackfillCreateRequest,
    HistoricalBackfillJobRepository,
)
from app.modules.historical_backfill.schemas import (
    HistoricalBackfillDetailResponse,
    HistoricalBackfillListResponse,
    HistoricalBackfillTriggerRequest,
    HistoricalBackfillTriggerResponse,
)
from app.services.audit import AuditLog


def _hash_payload(payload: dict[str, object]) -> str:
    dumped = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(dumped.encode("utf-8")).hexdigest()


def _to_detail(model) -> HistoricalBackfillDetailResponse:
    return HistoricalBackfillDetailResponse(
        job_id=model.id,
        status=model.status,
        code=model.code,
        requested_start_date=model.requested_start_date,
        requested_end_date=model.requested_end_date,
        overwrite_mode=model.overwrite_mode,
        rows_written=model.rows_written,
        rows_processed=model.rows_processed,
        rows_failed_validation=model.rows_failed_validation,
        rows_skipped_conflict=model.rows_skipped_conflict,
        retry_count=model.retry_count,
        processed_chunks=model.processed_chunks,
        total_chunks=model.total_chunks,
        checkpoint_cursor=model.checkpoint_cursor,
        error_message=model.error_message,
        created_at=model.created_at.isoformat(),
        started_at=model.started_at.isoformat() if model.started_at else None,
        finished_at=model.finished_at.isoformat() if model.finished_at else None,
        last_heartbeat_at=model.last_heartbeat_at.isoformat() if model.last_heartbeat_at else None,
    )


@dataclass
class HistoricalBackfillService:
    repository: HistoricalBackfillJobRepository
    audit_log: AuditLog

    def trigger(
        self,
        request: HistoricalBackfillTriggerRequest,
        actor: str,
    ) -> HistoricalBackfillTriggerResponse:
        if request.start_date > request.end_date:
            raise ValueError("invalid_date_range")
        if request.overwrite_mode not in {"closed_only", "force"}:
            raise ValueError("invalid_overwrite_mode")

        created = self.repository.create_or_get_active(
            BackfillCreateRequest(
                code=request.code,
                start_date=request.start_date,
                end_date=request.end_date,
                overwrite_mode=request.overwrite_mode,
            )
        )
        self.audit_log.record(
            event_type="historical_backfill_triggered",
            path="/api/admin/backfill/historical-jobs",
            actor=actor,
            role="admin",
            metadata={
                "request_payload_hash": _hash_payload(request.model_dump(mode="json")),
                "job_id": created.id,
            },
        )
        return HistoricalBackfillTriggerResponse(job_id=created.id, status=created.status)

    def get(self, job_id: int) -> HistoricalBackfillDetailResponse | None:
        model = self.repository.get(job_id)
        if model is None:
            return None
        return _to_detail(model)

    def list(
        self,
        *,
        status: str | None,
        limit: int,
        offset: int,
    ) -> HistoricalBackfillListResponse:
        items, total = self.repository.list(status=status, limit=limit, offset=offset)
        return HistoricalBackfillListResponse(
            items=[_to_detail(item) for item in items],
            pagination={"limit": limit, "offset": offset, "total": total},
        )
