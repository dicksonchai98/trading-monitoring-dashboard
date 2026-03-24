from __future__ import annotations

from app.db.session import SessionLocal
from app.models.email_delivery_log import EmailDeliveryLogModel
from app.models.email_outbox import EmailOutboxModel
from app.repositories.email_delivery_log_repository import EmailDeliveryLogRepository
from app.repositories.email_outbox_repository import EmailOutboxRepository
from app.services.email_provider import EmailSendResult
from sqlalchemy import select
from workers.email_worker import EmailWorker


class _FakeProvider:
    def __init__(self, *, accepted: bool) -> None:
        self.accepted = accepted

    def send(
        self,
        *,
        recipient: str,
        template_name: str,
        payload: dict[str, object],
    ) -> EmailSendResult:
        _ = (recipient, template_name, payload)
        if self.accepted:
            return EmailSendResult(
                accepted=True,
                provider="sendgrid",
                provider_message_id="sg-001",
                raw_payload={"status_code": 202},
            )
        return EmailSendResult(
            accepted=False,
            provider="sendgrid",
            error_message="provider_error",
            raw_payload={"status_code": 500},
        )


def test_email_worker_marks_outbox_sent_and_logs_delivery() -> None:
    outbox_repo = EmailOutboxRepository(session_factory=SessionLocal)
    log_repo = EmailDeliveryLogRepository(session_factory=SessionLocal)
    outbox = outbox_repo.create_task(
        email_type=EmailOutboxModel.EmailType.OTP,
        recipient="u@example.com",
        template_name="otp_template",
        payload_json={"otp_code": "123456"},
        idempotency_key="otp:u@example.com:worker-1",
    )
    worker = EmailWorker(
        outbox_repository=outbox_repo,
        delivery_log_repository=log_repo,
        provider=_FakeProvider(accepted=True),
    )

    result = worker.handle_message({"outbox_id": outbox.id, "email_type": "otp"})

    assert result == "sent"
    assert outbox_repo.get_status(outbox.id) == "sent"
    with SessionLocal() as session:
        row = session.execute(
            select(EmailDeliveryLogModel).where(EmailDeliveryLogModel.outbox_id == outbox.id)
        ).scalar_one()
        assert row.result == "sent"
        assert row.event_type == "delivered"


def test_email_worker_marks_outbox_failed_and_increments_retry() -> None:
    outbox_repo = EmailOutboxRepository(session_factory=SessionLocal)
    log_repo = EmailDeliveryLogRepository(session_factory=SessionLocal)
    outbox = outbox_repo.create_task(
        email_type=EmailOutboxModel.EmailType.OTP,
        recipient="u@example.com",
        template_name="otp_template",
        payload_json={"otp_code": "123456"},
        idempotency_key="otp:u@example.com:worker-2",
    )
    worker = EmailWorker(
        outbox_repository=outbox_repo,
        delivery_log_repository=log_repo,
        provider=_FakeProvider(accepted=False),
    )

    result = worker.handle_message({"outbox_id": outbox.id, "email_type": "otp"})

    assert result == "failed"
    assert outbox_repo.get_status(outbox.id) == "failed"
    refreshed = outbox_repo.get_by_id(outbox.id)
    assert refreshed is not None
    assert refreshed.retry_count == 1
