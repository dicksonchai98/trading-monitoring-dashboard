from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.repositories.otp_challenge_repository import OtpChallengeRepository
from app.repositories.otp_verification_token_repository import OtpVerificationTokenRepository


def test_token_consume_is_one_time() -> None:
    challenge_repo = OtpChallengeRepository(session_factory=SessionLocal)
    token_repo = OtpVerificationTokenRepository(session_factory=SessionLocal)

    challenge = challenge_repo.create_or_replace_pending(
        email="token@example.com",
        otp_hash="hash",
        expires_at=datetime.now(tz=timezone.utc) + timedelta(minutes=5),
    )

    token_repo.create_token(
        token_hash="token_hash_1",
        challenge_id=challenge.id,
        email=challenge.email,
        purpose="register",
        expires_at=datetime.now(tz=timezone.utc) + timedelta(minutes=10),
    )

    now = datetime.now(tz=timezone.utc)
    first_consume = token_repo.consume_token(
        "token_hash_1",
        email=challenge.email,
        purpose="register",
        not_expired_at=now,
    )
    second_consume = token_repo.consume_token(
        "token_hash_1",
        email=challenge.email,
        purpose="register",
        not_expired_at=now,
    )

    assert first_consume is not None
    assert first_consume.used_at is not None
    assert second_consume is None
