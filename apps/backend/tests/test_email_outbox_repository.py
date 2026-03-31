from __future__ import annotations

import pytest
from app.db.session import SessionLocal
from app.models.email_outbox import EmailOutboxModel
from app.repositories.email_outbox_repository import EmailOutboxRepository


def test_outbox_create_task_defaults_pending() -> None:
    repo = EmailOutboxRepository(session_factory=SessionLocal)
    task = repo.create_task(
        email_type=EmailOutboxModel.EmailType.OTP,
        recipient="u@example.com",
        template_name="otp_template",
        payload_json={"otp_code": "***"},
        idempotency_key="otp:u@example.com:1",
    )
    assert task.status == "pending"
    assert task.email_type == "otp"


def test_outbox_idempotency_key_unique() -> None:
    repo = EmailOutboxRepository(session_factory=SessionLocal)
    repo.create_task(
        email_type=EmailOutboxModel.EmailType.OTP,
        recipient="u@example.com",
        template_name="otp_template",
        payload_json={"otp_code": "***"},
        idempotency_key="otp:u@example.com:1",
    )

    with pytest.raises(ValueError, match="duplicate_outbox"):
        repo.create_task(
            email_type=EmailOutboxModel.EmailType.OTP,
            recipient="u@example.com",
            template_name="otp_template",
            payload_json={"otp_code": "***"},
            idempotency_key="otp:u@example.com:1",
        )


def test_outbox_status_transitions_and_retry_increment() -> None:
    repo = EmailOutboxRepository(session_factory=SessionLocal)
    task = repo.create_task(
        email_type=EmailOutboxModel.EmailType.NOTIFICATION,
        recipient="n@example.com",
        template_name="notify_template",
        payload_json={"message": "hello"},
        idempotency_key="notify:n@example.com:1",
    )

    repo.mark_processing(task.id)
    assert repo.get_status(task.id) == "processing"

    repo.mark_failed_and_increment_retry(task.id)
    assert repo.get_status(task.id) == "failed"

    refreshed = repo.get_by_id(task.id)
    assert refreshed is not None
    assert refreshed.retry_count == 1
