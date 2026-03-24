"""Repository for OTP verification tokens."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.otp_verification_token import OtpVerificationTokenModel


@dataclass
class OtpVerificationTokenRecord:
    id: str
    token_hash: str
    challenge_id: str
    email: str
    purpose: str
    expires_at: datetime
    used_at: datetime | None


class OtpVerificationTokenRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def create_token(
        self,
        token_hash: str,
        challenge_id: str,
        email: str,
        purpose: str,
        expires_at: datetime,
    ) -> OtpVerificationTokenRecord:
        with self._session_factory() as session:
            model = OtpVerificationTokenModel(
                token_hash=token_hash,
                challenge_id=challenge_id,
                email=email,
                purpose=purpose,
                expires_at=expires_at,
            )
            session.add(model)
            session.commit()
            session.refresh(model)
            return OtpVerificationTokenRecord(
                id=model.id,
                token_hash=model.token_hash,
                challenge_id=model.challenge_id,
                email=model.email,
                purpose=model.purpose,
                expires_at=model.expires_at,
                used_at=model.used_at,
            )

    def get_by_token_hash(self, token_hash: str) -> OtpVerificationTokenRecord | None:
        with self._session_factory() as session:
            stmt = select(OtpVerificationTokenModel).where(
                OtpVerificationTokenModel.token_hash == token_hash
            )
            model = session.execute(stmt).scalar_one_or_none()
            if model is None:
                return None
            return OtpVerificationTokenRecord(
                id=model.id,
                token_hash=model.token_hash,
                challenge_id=model.challenge_id,
                email=model.email,
                purpose=model.purpose,
                expires_at=model.expires_at,
                used_at=model.used_at,
            )

    def consume_token(
        self,
        token_hash: str,
        *,
        email: str,
        purpose: str,
        not_expired_at: datetime,
    ) -> OtpVerificationTokenRecord | None:
        with self._session_factory() as session:
            used_at = datetime.now(tz=timezone.utc)
            update_stmt = (
                update(OtpVerificationTokenModel)
                .where(
                    OtpVerificationTokenModel.token_hash == token_hash,
                    OtpVerificationTokenModel.email == email,
                    OtpVerificationTokenModel.purpose == purpose,
                    OtpVerificationTokenModel.expires_at > not_expired_at,
                    OtpVerificationTokenModel.used_at.is_(None),
                )
                .values(used_at=used_at)
            )
            result = session.execute(update_stmt)
            if result.rowcount != 1:
                session.rollback()
                return None

            stmt = select(OtpVerificationTokenModel).where(
                OtpVerificationTokenModel.token_hash == token_hash
            )
            model = session.execute(stmt).scalar_one_or_none()
            if model is None:
                session.rollback()
                return None
            session.commit()
            return OtpVerificationTokenRecord(
                id=model.id,
                token_hash=model.token_hash,
                challenge_id=model.challenge_id,
                email=model.email,
                purpose=model.purpose,
                expires_at=model.expires_at,
                used_at=model.used_at,
            )
