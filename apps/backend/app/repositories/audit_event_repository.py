"""Repository for persistent audit events."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit_event import AuditEventModel


@dataclass
class AuditEventRecord:
    id: int
    event_type: str
    path: str
    actor: str | None
    role: str | None
    result: str | None
    metadata: dict[str, Any]
    created_at: datetime


class AuditEventRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def insert(
        self,
        *,
        event_type: str,
        path: str,
        actor: str | None,
        role: str | None,
        result: str | None,
        metadata: dict[str, Any] | None,
        created_at: datetime,
    ) -> AuditEventRecord:
        with self._session_factory() as session:
            model = AuditEventModel(
                event_type=event_type,
                path=path,
                actor=actor,
                role=role,
                result=result,
                metadata_json=metadata or {},
                created_at=created_at,
            )
            session.add(model)
            session.commit()
            session.refresh(model)
            return self._to_record(model)

    def query(
        self,
        *,
        from_ts: datetime | None,
        to_ts: datetime | None,
        event_type: str | None,
        actor: str | None,
        path: str | None,
        result: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[AuditEventRecord], int]:
        with self._session_factory() as session:
            stmt = select(AuditEventModel)
            count_stmt = select(func.count()).select_from(AuditEventModel)

            if from_ts is not None:
                stmt = stmt.where(AuditEventModel.created_at >= from_ts)
                count_stmt = count_stmt.where(AuditEventModel.created_at >= from_ts)
            if to_ts is not None:
                stmt = stmt.where(AuditEventModel.created_at <= to_ts)
                count_stmt = count_stmt.where(AuditEventModel.created_at <= to_ts)
            if event_type:
                stmt = stmt.where(AuditEventModel.event_type == event_type)
                count_stmt = count_stmt.where(AuditEventModel.event_type == event_type)
            if actor:
                pattern = f"%{actor}%"
                stmt = stmt.where(AuditEventModel.actor.ilike(pattern))
                count_stmt = count_stmt.where(AuditEventModel.actor.ilike(pattern))
            if path:
                pattern = f"%{path}%"
                stmt = stmt.where(AuditEventModel.path.ilike(pattern))
                count_stmt = count_stmt.where(AuditEventModel.path.ilike(pattern))
            if result:
                stmt = stmt.where(AuditEventModel.result == result)
                count_stmt = count_stmt.where(AuditEventModel.result == result)

            stmt = stmt.order_by(AuditEventModel.created_at.desc()).offset(offset).limit(limit)
            items = [self._to_record(item) for item in session.execute(stmt).scalars()]
            total = int(session.execute(count_stmt).scalar_one())
            return items, total

    def count(self) -> int:
        with self._session_factory() as session:
            stmt = select(func.count()).select_from(AuditEventModel)
            return int(session.execute(stmt).scalar_one())

    def delete_all(self) -> int:
        with self._session_factory() as session:
            deleted = session.query(AuditEventModel).delete()
            session.commit()
            return int(deleted)

    @staticmethod
    def _to_record(model: AuditEventModel) -> AuditEventRecord:
        return AuditEventRecord(
            id=model.id,
            event_type=model.event_type,
            path=model.path,
            actor=model.actor,
            role=model.role,
            result=model.result,
            metadata=dict(model.metadata_json or {}),
            created_at=model.created_at,
        )
