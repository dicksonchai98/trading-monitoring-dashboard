"""Repository layer for historical backfill jobs."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Callable

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.models.historical_backfill_job import HistoricalBackfillJobModel
from app.modules.historical_backfill.types import ACTIVE_BACKFILL_STATUSES, BackfillJobStatus


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


@dataclass(frozen=True)
class BackfillCreateRequest:
    code: str
    start_date: date
    end_date: date
    overwrite_mode: str


class HistoricalBackfillJobRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def create_or_get_active(self, req: BackfillCreateRequest) -> HistoricalBackfillJobModel:
        with self._session_factory() as session:
            with session.begin():
                stmt = (
                    select(HistoricalBackfillJobModel)
                    .where(
                        HistoricalBackfillJobModel.code == req.code,
                        HistoricalBackfillJobModel.requested_start_date == req.start_date,
                        HistoricalBackfillJobModel.requested_end_date == req.end_date,
                        HistoricalBackfillJobModel.overwrite_mode == req.overwrite_mode,
                        HistoricalBackfillJobModel.status.in_(tuple(ACTIVE_BACKFILL_STATUSES)),
                    )
                    .order_by(desc(HistoricalBackfillJobModel.id))
                    .with_for_update()
                )
                existing = session.execute(stmt).scalar_one_or_none()
                if existing is not None:
                    return existing

                model = HistoricalBackfillJobModel(
                    code=req.code,
                    requested_start_date=req.start_date,
                    requested_end_date=req.end_date,
                    overwrite_mode=req.overwrite_mode,
                    status=BackfillJobStatus.CREATED.value,
                    created_at=_utcnow(),
                    last_heartbeat_at=_utcnow(),
                )
                session.add(model)
            session.refresh(model)
            return model

    def get(self, job_id: int) -> HistoricalBackfillJobModel | None:
        with self._session_factory() as session:
            return session.get(HistoricalBackfillJobModel, job_id)

    def mark_running(self, job_id: int) -> None:
        with self._session_factory() as session:
            model = session.get(HistoricalBackfillJobModel, job_id)
            if model is None:
                return
            model.status = BackfillJobStatus.RUNNING.value
            if model.started_at is None:
                model.started_at = _utcnow()
            model.last_heartbeat_at = _utcnow()
            session.commit()

    def mark_retrying(self, job_id: int, retry_count: int) -> None:
        with self._session_factory() as session:
            model = session.get(HistoricalBackfillJobModel, job_id)
            if model is None:
                return
            model.status = BackfillJobStatus.RETRYING.value
            model.retry_count = retry_count
            model.last_heartbeat_at = _utcnow()
            session.commit()

    def mark_completed(self, job_id: int, *, rows_processed: int, rows_written: int) -> None:
        with self._session_factory() as session:
            model = session.get(HistoricalBackfillJobModel, job_id)
            if model is None:
                return
            model.status = BackfillJobStatus.COMPLETED.value
            model.rows_processed = rows_processed
            model.rows_written = rows_written
            model.finished_at = _utcnow()
            model.last_heartbeat_at = _utcnow()
            if model.total_chunks is not None and model.total_chunks > 0:
                model.processed_chunks = model.total_chunks
            session.commit()

    def mark_failed(self, job_id: int, *, error_message: str) -> None:
        with self._session_factory() as session:
            model = session.get(HistoricalBackfillJobModel, job_id)
            if model is None:
                return
            model.status = BackfillJobStatus.FAILED.value
            model.error_message = error_message
            model.finished_at = _utcnow()
            model.last_heartbeat_at = _utcnow()
            session.commit()

    def update_progress(
        self,
        job_id: int,
        *,
        rows_processed: int | None = None,
        rows_written: int | None = None,
        rows_failed_validation: int | None = None,
        rows_skipped_conflict: int | None = None,
        processed_chunks: int | None = None,
        total_chunks: int | None = None,
        checkpoint_cursor: str | None = None,
        heartbeat_at: datetime | None = None,
    ) -> None:
        with self._session_factory() as session:
            model = session.get(HistoricalBackfillJobModel, job_id)
            if model is None:
                return
            if rows_processed is not None:
                model.rows_processed = rows_processed
            if rows_written is not None:
                model.rows_written = rows_written
            if rows_failed_validation is not None:
                model.rows_failed_validation = rows_failed_validation
            if rows_skipped_conflict is not None:
                model.rows_skipped_conflict = rows_skipped_conflict
            if processed_chunks is not None:
                model.processed_chunks = processed_chunks
            if total_chunks is not None:
                model.total_chunks = total_chunks
            if checkpoint_cursor is not None:
                model.checkpoint_cursor = checkpoint_cursor
            model.last_heartbeat_at = heartbeat_at or _utcnow()
            session.commit()

    def list(
        self, *, status: str | None, limit: int, offset: int
    ) -> tuple[list[HistoricalBackfillJobModel], int]:
        with self._session_factory() as session:
            predicate = []
            if status:
                predicate.append(HistoricalBackfillJobModel.status == status)
            where_clause = and_(*predicate) if predicate else None
            stmt = select(HistoricalBackfillJobModel).order_by(desc(HistoricalBackfillJobModel.id))
            count_stmt = select(func.count()).select_from(HistoricalBackfillJobModel)
            if where_clause is not None:
                stmt = stmt.where(where_clause)
                count_stmt = count_stmt.where(where_clause)
            total = int(session.execute(count_stmt).scalar_one())
            items = list(session.execute(stmt.offset(offset).limit(limit)).scalars())
            return items, total

    def list_active(self) -> list[HistoricalBackfillJobModel]:
        with self._session_factory() as session:
            stmt = (
                select(HistoricalBackfillJobModel)
                .where(HistoricalBackfillJobModel.status.in_(tuple(ACTIVE_BACKFILL_STATUSES)))
                .order_by(desc(HistoricalBackfillJobModel.id))
            )
            return list(session.execute(stmt).scalars())
