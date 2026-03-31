"""Notification domain email service."""

from __future__ import annotations

from app.models.email_outbox import EmailOutboxModel
from app.repositories.email_outbox_repository import EmailOutboxRecord, EmailOutboxRepository


class NotificationEmailService:
    def __init__(self, *, outbox_repository: EmailOutboxRepository) -> None:
        self._outbox_repository = outbox_repository

    def queue_notification(
        self,
        *,
        recipient: str,
        template_name: str,
        payload: dict[str, object],
        idempotency_key: str,
    ) -> EmailOutboxRecord:
        if not recipient or "@" not in recipient:
            raise ValueError("invalid_recipient")
        if not template_name:
            raise ValueError("invalid_template")
        if not payload:
            raise ValueError("invalid_payload")

        return self._outbox_repository.create_task(
            email_type=EmailOutboxModel.EmailType.NOTIFICATION,
            recipient=recipient,
            template_name=template_name,
            payload_json=payload,
            idempotency_key=idempotency_key,
        )
