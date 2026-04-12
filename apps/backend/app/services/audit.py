"""Security audit event sink for admin/auth failures."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from app.repositories.audit_event_repository import AuditEventRepository
from app.services.metrics import Metrics

logger = logging.getLogger(__name__)


@dataclass
class SecurityEvent:
    event_type: str
    path: str
    actor: str | None
    role: str | None
    timestamp: str
    result: str | None = None
    metadata: dict[str, str | int | float | bool | None] | None = None


class AuditLog:
    def __init__(
        self,
        *,
        repository: AuditEventRepository | None = None,
        metrics: Metrics | None = None,
    ) -> None:
        self.events: list[SecurityEvent] = []
        self._repository = repository
        self._metrics = metrics

    def record(
        self,
        event_type: str,
        path: str,
        actor: str | None,
        role: str | None,
        result: str | None = None,
        metadata: dict[str, str | int | float | bool | None] | None = None,
    ) -> None:
        now = datetime.now(tz=timezone.utc)
        resolved_result = result or self._resolve_result(event_type)
        self.events.append(
            SecurityEvent(
                event_type=event_type,
                path=path,
                actor=actor,
                role=role,
                timestamp=now.isoformat(),
                result=resolved_result,
                metadata=metadata,
            )
        )
        if self._repository is None:
            return
        try:
            self._repository.insert(
                event_type=event_type,
                path=path,
                actor=actor,
                role=role,
                result=resolved_result,
                metadata=dict(metadata or {}),
                created_at=now,
            )
            if self._metrics is not None:
                self._metrics.inc("audit_write_success_total")
        except Exception:
            logger.exception("audit event persist failed")
            if self._metrics is not None:
                self._metrics.inc("audit_write_failure_total")

    @staticmethod
    def _resolve_result(event_type: str) -> str:
        normalized = event_type.lower()
        if "denied" in normalized:
            return "denied"
        if "failed" in normalized or "error" in normalized:
            return "error"
        if "triggered" in normalized:
            return "accepted"
        if normalized:
            return "success"
        return "unknown"
