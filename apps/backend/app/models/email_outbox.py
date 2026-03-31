"""Email outbox ORM model."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from sqlalchemy import JSON, DateTime, Index, Integer, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class EmailOutboxModel(Base):
    __tablename__ = "email_outbox"
    __table_args__ = (Index("ix_email_outbox_idempotency_key", "idempotency_key", unique=True),)

    class EmailType(str, Enum):
        OTP = "otp"
        NOTIFICATION = "notification"

    class Status(str, Enum):
        PENDING = "pending"
        PROCESSING = "processing"
        SENT = "sent"
        FAILED = "failed"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email_type: Mapped[EmailType] = mapped_column(
        SQLEnum(
            EmailType,
            name="email_outbox_type",
            native_enum=False,
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
    )
    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    template_name: Mapped[str] = mapped_column(String(128), nullable=False)
    payload_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    status: Mapped[Status] = mapped_column(
        SQLEnum(
            Status,
            name="email_outbox_status",
            native_enum=False,
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
        default=Status.PENDING,
    )
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_retry: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
