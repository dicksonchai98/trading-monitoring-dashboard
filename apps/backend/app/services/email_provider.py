"""Email provider contracts."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class EmailSendResult:
    accepted: bool
    provider: str
    provider_message_id: str | None = None
    error_message: str | None = None
    raw_payload: dict[str, object] | None = None


class EmailProvider(Protocol):
    def send(
        self,
        *,
        recipient: str,
        template_name: str,
        payload: dict[str, object],
    ) -> EmailSendResult: ...
