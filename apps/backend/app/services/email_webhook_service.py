"""Handle SendGrid webhook verification and event write-back."""

from __future__ import annotations

import hashlib
import hmac
import json

from app.config import SENDGRID_WEBHOOK_SIGNING_KEY
from app.repositories.email_delivery_log_repository import EmailDeliveryLogRepository
from app.repositories.email_outbox_repository import EmailOutboxRepository

SUPPORTED_EVENTS = {"delivered", "bounce", "dropped", "deferred"}


class EmailWebhookService:
    def __init__(
        self,
        *,
        outbox_repository: EmailOutboxRepository,
        delivery_log_repository: EmailDeliveryLogRepository,
    ) -> None:
        self._outbox_repository = outbox_repository
        self._delivery_log_repository = delivery_log_repository

    def verify_signature(self, payload: bytes, signature: str | None) -> bool:
        if not SENDGRID_WEBHOOK_SIGNING_KEY:
            return True
        if not signature:
            return False
        digest = hmac.new(
            SENDGRID_WEBHOOK_SIGNING_KEY.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(digest, signature)

    def process_events(self, events: list[dict[str, object]]) -> int:
        processed = 0
        for event in events:
            event_type = str(event.get("event", ""))
            if event_type not in SUPPORTED_EVENTS:
                continue
            outbox_id = str(event.get("outbox_id", ""))
            if not outbox_id:
                continue

            outbox = self._outbox_repository.get_by_id(outbox_id)
            attempt_no = 1 if outbox is None else outbox.retry_count + 1
            provider_message_id = str(event.get("sg_message_id", "")) or None

            if event_type == "delivered":
                self._outbox_repository.mark_sent(outbox_id)
                result = "sent"
            else:
                self._outbox_repository.mark_failed(outbox_id)
                result = "failed"

            self._delivery_log_repository.append(
                outbox_id=outbox_id,
                provider="sendgrid",
                event_type=event_type,
                result=result,
                attempt_no=attempt_no,
                provider_payload_json=json.loads(json.dumps(event)),
                provider_message_id=provider_message_id,
                error_message=None,
            )
            processed += 1
        return processed
