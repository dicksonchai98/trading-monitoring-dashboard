from __future__ import annotations

from app.db.session import SessionLocal
from app.repositories.email_outbox_repository import EmailOutboxRepository
from app.services.notification_email_service import NotificationEmailService


def test_notification_service_creates_outbox_task_with_idempotency() -> None:
    service = NotificationEmailService(
        outbox_repository=EmailOutboxRepository(session_factory=SessionLocal)
    )

    task = service.queue_notification(
        recipient="u@example.com",
        template_name="risk_alert",
        payload={"score": 98},
        idempotency_key="notify:risk_alert:u@example.com:20260323",
    )

    assert task.email_type == "notification"
    assert task.status == "pending"
    assert task.idempotency_key == "notify:risk_alert:u@example.com:20260323"
