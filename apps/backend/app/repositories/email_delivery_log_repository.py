"""Repository for email delivery logs."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.email_delivery_log import EmailDeliveryLogModel


@dataclass
class EmailDeliveryLogRecord:
    id: str
    outbox_id: str
    provider: str
    event_type: str
    result: str
    attempt_no: int


class EmailDeliveryLogRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def append(
        self,
        outbox_id: str,
        provider: str,
        event_type: str,
        result: str,
        attempt_no: int,
        provider_payload_json: dict[str, object],
        provider_message_id: str | None = None,
        error_message: str | None = None,
    ) -> EmailDeliveryLogRecord:
        with self._session_factory() as session:
            model = EmailDeliveryLogModel(
                outbox_id=outbox_id,
                provider=provider,
                provider_message_id=provider_message_id,
                event_type=event_type,
                result=result,
                error_message=error_message,
                attempt_no=attempt_no,
                provider_payload_json=provider_payload_json,
            )
            session.add(model)
            session.commit()
            session.refresh(model)
            return EmailDeliveryLogRecord(
                id=model.id,
                outbox_id=model.outbox_id,
                provider=model.provider,
                event_type=model.event_type,
                result=model.result,
                attempt_no=model.attempt_no,
            )
