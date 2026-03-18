"""Service layer for historical backfill job APIs."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

from app.modules.batch_shared.repositories.job_repository import JobRepository
from app.modules.batch_shared.services.admin_jobs import BatchJobAdminService
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


def _build_dedupe_key(payload: dict[str, object]) -> str:
    dumped = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return dumped


def _to_trigger_response(model) -> HistoricalBackfillTriggerResponse:
    return HistoricalBackfillTriggerResponse(
        job_id=model.id,
        worker_type=model.worker_type,
        job_type=model.job_type,
        status=model.status,
    )


def _to_detail(model) -> HistoricalBackfillDetailResponse:
    metadata = model.metadata_json or {}
    return HistoricalBackfillDetailResponse(
        job_id=model.id,
        status=model.status,
        code=str(metadata.get("code", "")),
        requested_start_date=metadata.get("start_date"),
        requested_end_date=metadata.get("end_date"),
        overwrite_mode=str(metadata.get("overwrite_mode", "closed_only")),
        rows_written=model.rows_processed,
        rows_processed=model.rows_processed,
        rows_failed_validation=0,
        rows_skipped_conflict=0,
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
    repository: JobRepository
    batch_admin_service: BatchJobAdminService
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

        metadata = request.model_dump(mode="json")
        dedupe_key = _build_dedupe_key(metadata)
        existing = self.repository.find_active_job(
            worker_type="historical_backfill",
            job_type="historical-backfill",
            dedupe_key=dedupe_key,
        )
        created = existing or self.batch_admin_service.create_and_enqueue(
            worker_type="historical_backfill",
            job_type="historical-backfill",
            dedupe_key=dedupe_key,
            metadata=metadata,
        )
        self.audit_log.record(
            event_type="historical_backfill_triggered",
            path="/api/admin/batch/backfill/jobs",
            actor=actor,
            role="admin",
            metadata={
                "request_payload_hash": _hash_payload(request.model_dump(mode="json")),
                "job_id": created.id,
            },
        )
        return _to_trigger_response(created)

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
        items, total = self.repository.list_jobs_paginated(
            worker_type="historical_backfill",
            status=status,
            limit=limit,
            offset=offset,
        )
        return HistoricalBackfillListResponse(
            items=[_to_detail(item) for item in items],
            pagination={"limit": limit, "offset": offset, "total": total},
        )
