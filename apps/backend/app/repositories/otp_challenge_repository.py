"""Repository for OTP challenges."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.otp_challenge import OtpChallengeModel
from app.utils.time import ensure_utc, utcnow


@dataclass
class OtpChallengeRecord:
    id: str
    email: str
    otp_hash: str
    status: str
    expires_at: datetime
    verify_attempts: int
    max_attempts: int
    last_sent_at: datetime


class OtpChallengeRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def create_or_replace_pending(
        self,
        email: str,
        otp_hash: str,
        expires_at: datetime,
        max_attempts: int = 5,
    ) -> OtpChallengeRecord:
        with self._session_factory() as session:
            stmt = select(OtpChallengeModel).where(
                OtpChallengeModel.email == email,
                OtpChallengeModel.status == OtpChallengeModel.Status.PENDING,
            )
            existing = session.execute(stmt).scalars().all()
            for row in existing:
                row.status = OtpChallengeModel.Status.EXPIRED
            model = OtpChallengeModel(
                email=email,
                otp_hash=otp_hash,
                status=OtpChallengeModel.Status.PENDING,
                expires_at=ensure_utc(expires_at),
                verify_attempts=0,
                max_attempts=max_attempts,
                last_sent_at=utcnow(),
            )
            session.add(model)
            try:
                session.commit()
            except IntegrityError:
                session.rollback()
                latest = self.get_latest_pending(email)
                if latest is not None:
                    return latest
                raise
            session.refresh(model)
            return OtpChallengeRecord(
                id=model.id,
                email=model.email,
                otp_hash=model.otp_hash,
                status=model.status.value,
                expires_at=ensure_utc(model.expires_at),
                verify_attempts=model.verify_attempts,
                max_attempts=model.max_attempts,
                last_sent_at=ensure_utc(model.last_sent_at),
            )

    def get_latest_pending(self, email: str) -> OtpChallengeRecord | None:
        with self._session_factory() as session:
            stmt = (
                select(OtpChallengeModel)
                .where(
                    OtpChallengeModel.email == email,
                    OtpChallengeModel.status == OtpChallengeModel.Status.PENDING,
                )
                .order_by(OtpChallengeModel.created_at.desc())
            )
            model = session.execute(stmt).scalars().first()
            if model is None:
                return None
            return OtpChallengeRecord(
                id=model.id,
                email=model.email,
                otp_hash=model.otp_hash,
                status=model.status.value,
                expires_at=ensure_utc(model.expires_at),
                verify_attempts=model.verify_attempts,
                max_attempts=model.max_attempts,
                last_sent_at=ensure_utc(model.last_sent_at),
            )

    def increment_verify_attempts(self, challenge_id: str) -> OtpChallengeRecord | None:
        with self._session_factory() as session:
            model = session.get(OtpChallengeModel, challenge_id)
            if model is None:
                return None
            model.verify_attempts += 1
            session.commit()
            session.refresh(model)
            return OtpChallengeRecord(
                id=model.id,
                email=model.email,
                otp_hash=model.otp_hash,
                status=model.status.value,
                expires_at=ensure_utc(model.expires_at),
                verify_attempts=model.verify_attempts,
                max_attempts=model.max_attempts,
                last_sent_at=ensure_utc(model.last_sent_at),
            )

    def update_status(
        self, challenge_id: str, status: OtpChallengeModel.Status
    ) -> OtpChallengeRecord | None:
        with self._session_factory() as session:
            model = session.get(OtpChallengeModel, challenge_id)
            if model is None:
                return None
            model.status = status
            session.commit()
            session.refresh(model)
            return OtpChallengeRecord(
                id=model.id,
                email=model.email,
                otp_hash=model.otp_hash,
                status=model.status.value,
                expires_at=ensure_utc(model.expires_at),
                verify_attempts=model.verify_attempts,
                max_attempts=model.max_attempts,
                last_sent_at=ensure_utc(model.last_sent_at),
            )
