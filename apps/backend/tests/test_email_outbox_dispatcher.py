from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.models.email_outbox import EmailOutboxModel
from app.repositories.email_outbox_repository import EmailOutboxRepository
from app.services.email_outbox_dispatcher import EmailOutboxDispatcher
from sqlalchemy import select


class FakeRedis:
    def __init__(self) -> None:
        self.xadd_calls: list[dict[str, object]] = []

    def xadd(self, stream: str, payload: dict[str, str]) -> None:
        self.xadd_calls.append({"stream": stream, "payload": payload})


class FailingRedis(FakeRedis):
    def xadd(self, stream: str, payload: dict[str, str]) -> None:
        raise RuntimeError("redis unavailable")


def test_dispatcher_pushes_pending_outbox_to_stream() -> None:
    repo = EmailOutboxRepository(session_factory=SessionLocal)
    task = repo.create_task(
        email_type=EmailOutboxModel.EmailType.OTP,
        recipient="u@example.com",
        template_name="otp_template",
        payload_json={"otp": "***"},
        idempotency_key="otp:u@example.com:dispatch-1",
    )
    redis = FakeRedis()
    dispatcher = EmailOutboxDispatcher(redis_client=redis, outbox_repository=repo)

    dispatched = dispatcher.dispatch_once(limit=10)

    assert dispatched == 1
    assert redis.xadd_calls[0]["stream"] == "email:outbox:stream"
    assert redis.xadd_calls[0]["payload"]["outbox_id"] == task.id
    assert repo.get_status(task.id) == "processing"


def test_dispatcher_marks_failed_when_publish_raises() -> None:
    repo = EmailOutboxRepository(session_factory=SessionLocal)
    task = repo.create_task(
        email_type=EmailOutboxModel.EmailType.OTP,
        recipient="u@example.com",
        template_name="otp_template",
        payload_json={"otp": "***"},
        idempotency_key="otp:u@example.com:dispatch-fail-1",
    )
    dispatcher = EmailOutboxDispatcher(redis_client=FailingRedis(), outbox_repository=repo)

    dispatched = dispatcher.dispatch_once(limit=10)

    assert dispatched == 0
    assert repo.get_status(task.id) == "failed"
    refreshed = repo.get_by_id(task.id)
    assert refreshed is not None
    assert refreshed.retry_count == 1


def test_dispatcher_recovers_stale_processing_rows() -> None:
    repo = EmailOutboxRepository(session_factory=SessionLocal)
    task = repo.create_task(
        email_type=EmailOutboxModel.EmailType.OTP,
        recipient="stale@example.com",
        template_name="otp_template",
        payload_json={"otp": "***"},
        idempotency_key="otp:stale@example.com:dispatch-recover-1",
    )
    repo.mark_processing(task.id)
    with SessionLocal() as session:
        row = session.execute(
            select(EmailOutboxModel).where(EmailOutboxModel.id == task.id)
        ).scalar_one()
        row.updated_at = datetime.now(tz=timezone.utc) - timedelta(minutes=5)
        session.commit()

    redis = FakeRedis()
    dispatcher = EmailOutboxDispatcher(redis_client=redis, outbox_repository=repo)
    dispatched = dispatcher.dispatch_once(limit=10)

    assert dispatched == 1
    assert repo.get_status(task.id) == "processing"
