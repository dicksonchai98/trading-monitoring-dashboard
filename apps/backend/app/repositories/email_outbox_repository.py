"""Repository for email outbox tasks."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.email_outbox import EmailOutboxModel


@dataclass
class EmailOutboxRecord:
    id: str
    email_type: str
    recipient: str
    template_name: str
    payload_json: dict[str, object]
    status: str
    retry_count: int
    max_retry: int
    idempotency_key: str


class EmailOutboxRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def create_task(
        self,
        email_type: EmailOutboxModel.EmailType,
        recipient: str,
        template_name: str,
        payload_json: dict[str, object],
        idempotency_key: str,
        max_retry: int = 3,
    ) -> EmailOutboxRecord:
        with self._session_factory() as session:
            model = EmailOutboxModel(
                email_type=email_type,
                recipient=recipient,
                template_name=template_name,
                payload_json=payload_json,
                status=EmailOutboxModel.Status.PENDING,
                retry_count=0,
                max_retry=max_retry,
                idempotency_key=idempotency_key,
            )
            session.add(model)
            try:
                session.commit()
            except IntegrityError as exc:
                session.rollback()
                raise ValueError("duplicate_outbox") from exc
            session.refresh(model)
            return EmailOutboxRecord(
                id=model.id,
                email_type=model.email_type.value,
                recipient=model.recipient,
                template_name=model.template_name,
                payload_json=model.payload_json,
                status=model.status.value,
                retry_count=model.retry_count,
                max_retry=model.max_retry,
                idempotency_key=model.idempotency_key,
            )

    def get_status(self, outbox_id: str) -> str | None:
        with self._session_factory() as session:
            row = session.get(EmailOutboxModel, outbox_id)
            return None if row is None else row.status.value

    def list_pending(self, limit: int) -> list[EmailOutboxRecord]:
        with self._session_factory() as session:
            stmt = (
                select(EmailOutboxModel)
                .where(EmailOutboxModel.status == EmailOutboxModel.Status.PENDING)
                .order_by(EmailOutboxModel.created_at.asc())
                .limit(limit)
            )
            rows = session.execute(stmt).scalars().all()
            return [
                EmailOutboxRecord(
                    id=row.id,
                    email_type=row.email_type.value,
                    recipient=row.recipient,
                    template_name=row.template_name,
                    payload_json=row.payload_json,
                    status=row.status.value,
                    retry_count=row.retry_count,
                    max_retry=row.max_retry,
                    idempotency_key=row.idempotency_key,
                )
                for row in rows
            ]

    def claim_pending(self, limit: int) -> list[EmailOutboxRecord]:
        claimed: list[EmailOutboxRecord] = []
        for row in self.list_pending(limit=limit):
            if self.mark_processing(row.id):
                claimed.append(row)
        return claimed

    def recover_stale_processing(self, *, timeout_seconds: int, limit: int) -> int:
        cutoff = datetime.now(tz=timezone.utc) - timedelta(seconds=timeout_seconds)
        recovered = 0
        with self._session_factory() as session:
            stmt = (
                select(EmailOutboxModel)
                .where(
                    EmailOutboxModel.status == EmailOutboxModel.Status.PROCESSING,
                    EmailOutboxModel.updated_at < cutoff,
                )
                .order_by(EmailOutboxModel.updated_at.asc())
                .limit(limit)
            )
            rows = session.execute(stmt).scalars().all()
            for row in rows:
                row.status = EmailOutboxModel.Status.PENDING
                recovered += 1
            if recovered > 0:
                session.commit()
        return recovered

    def get_by_id(self, outbox_id: str) -> EmailOutboxRecord | None:
        with self._session_factory() as session:
            row = session.get(EmailOutboxModel, outbox_id)
            if row is None:
                return None
            return EmailOutboxRecord(
                id=row.id,
                email_type=row.email_type.value,
                recipient=row.recipient,
                template_name=row.template_name,
                payload_json=row.payload_json,
                status=row.status.value,
                retry_count=row.retry_count,
                max_retry=row.max_retry,
                idempotency_key=row.idempotency_key,
            )

    def mark_sent(self, outbox_id: str) -> None:
        with self._session_factory() as session:
            stmt = select(EmailOutboxModel).where(EmailOutboxModel.id == outbox_id)
            row = session.execute(stmt).scalar_one_or_none()
            if row is None:
                return
            row.status = EmailOutboxModel.Status.SENT
            session.commit()

    def mark_processing(self, outbox_id: str) -> bool:
        with self._session_factory() as session:
            stmt = select(EmailOutboxModel).where(
                EmailOutboxModel.id == outbox_id,
                EmailOutboxModel.status == EmailOutboxModel.Status.PENDING,
            )
            row = session.execute(stmt).scalar_one_or_none()
            if row is None:
                return False
            row.status = EmailOutboxModel.Status.PROCESSING
            session.commit()
            return True

    def mark_failed_and_increment_retry(self, outbox_id: str) -> None:
        with self._session_factory() as session:
            row = session.get(EmailOutboxModel, outbox_id)
            if row is None:
                return
            row.retry_count += 1
            row.status = EmailOutboxModel.Status.FAILED
            session.commit()

    def mark_failed(self, outbox_id: str) -> None:
        with self._session_factory() as session:
            row = session.get(EmailOutboxModel, outbox_id)
            if row is None:
                return
            row.status = EmailOutboxModel.Status.FAILED
            session.commit()
