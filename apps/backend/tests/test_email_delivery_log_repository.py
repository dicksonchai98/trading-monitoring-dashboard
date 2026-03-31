from __future__ import annotations

from app.db.session import SessionLocal
from app.models.email_outbox import EmailOutboxModel
from app.repositories.email_delivery_log_repository import EmailDeliveryLogRepository
from app.repositories.email_outbox_repository import EmailOutboxRepository


def test_append_delivery_log() -> None:
    outbox_repo = EmailOutboxRepository(session_factory=SessionLocal)
    log_repo = EmailDeliveryLogRepository(session_factory=SessionLocal)

    outbox = outbox_repo.create_task(
        email_type=EmailOutboxModel.EmailType.OTP,
        recipient="u@example.com",
        template_name="otp_template",
        payload_json={"otp": "***"},
        idempotency_key="otp:u@example.com:delivery-1",
    )

    entry = log_repo.append(
        outbox_id=outbox.id,
        provider="sendgrid",
        event_type="delivered",
        result="sent",
        attempt_no=1,
        provider_payload_json={"event": "delivered"},
        provider_message_id="sg-msg-1",
        error_message=None,
    )

    assert entry.outbox_id == outbox.id
    assert entry.provider == "sendgrid"
    assert entry.event_type == "delivered"
    assert entry.result == "sent"
    assert entry.attempt_no == 1
