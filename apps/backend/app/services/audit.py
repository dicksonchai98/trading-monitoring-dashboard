"""Security audit event sink for admin/auth failures."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass
class SecurityEvent:
    event_type: str
    path: str
    actor: str | None
    role: str | None
    timestamp: str
    metadata: dict[str, str | int | float | bool | None] | None = None


class AuditLog:
    def __init__(self) -> None:
        self.events: list[SecurityEvent] = []

    def record(
        self,
        event_type: str,
        path: str,
        actor: str | None,
        role: str | None,
        metadata: dict[str, str | int | float | bool | None] | None = None,
    ) -> None:
        self.events.append(
            SecurityEvent(
                event_type=event_type,
                path=path,
                actor=actor,
                role=role,
                timestamp=datetime.now(tz=timezone.utc).isoformat(),
                metadata=metadata,
            )
        )
