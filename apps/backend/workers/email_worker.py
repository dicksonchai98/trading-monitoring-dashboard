"""Email worker that sends outbox tasks via configured provider."""

from __future__ import annotations

from app.repositories.email_delivery_log_repository import EmailDeliveryLogRepository
from app.repositories.email_outbox_repository import EmailOutboxRepository
from app.services.email_provider import EmailProvider


class EmailWorker:
    def __init__(
        self,
        *,
        outbox_repository: EmailOutboxRepository,
        delivery_log_repository: EmailDeliveryLogRepository,
        provider: EmailProvider,
    ) -> None:
        self._outbox_repository = outbox_repository
        self._delivery_log_repository = delivery_log_repository
        self._provider = provider

    def handle_message(self, message: dict[str, str]) -> str:
        outbox_id = message["outbox_id"]
        task = self._outbox_repository.get_by_id(outbox_id)
        if task is None:
            return "missing"
        if task.status == "sent":
            return "skipped"

        attempt_no = task.retry_count + 1
        result = self._provider.send(
            recipient=task.recipient,
            template_name=task.template_name,
            payload=task.payload_json,
        )
        if result.accepted:
            self._outbox_repository.mark_sent(task.id)
            self._delivery_log_repository.append(
                outbox_id=task.id,
                provider=result.provider,
                event_type="delivered",
                result="sent",
                attempt_no=attempt_no,
                provider_payload_json=result.raw_payload or {},
                provider_message_id=result.provider_message_id,
                error_message=None,
            )
            return "sent"

        self._outbox_repository.mark_failed_and_increment_retry(task.id)
        self._delivery_log_repository.append(
            outbox_id=task.id,
            provider=result.provider,
            event_type="failed",
            result="failed",
            attempt_no=attempt_no,
            provider_payload_json=result.raw_payload or {},
            provider_message_id=result.provider_message_id,
            error_message=result.error_message,
        )
        return "failed"
