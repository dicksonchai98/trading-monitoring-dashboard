from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.models.otp_challenge import OtpChallengeModel
from app.repositories.otp_challenge_repository import OtpChallengeRepository


def test_create_or_refresh_pending_challenge_per_email() -> None:
    repo = OtpChallengeRepository(session_factory=SessionLocal)
    expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=5)
    first = repo.create_or_replace_pending(
        email="u@example.com", otp_hash="h1", expires_at=expires_at
    )
    second = repo.create_or_replace_pending(
        email="u@example.com",
        otp_hash="h2",
        expires_at=expires_at + timedelta(minutes=1),
    )
    assert first.id != second.id
    latest = repo.get_latest_pending("u@example.com")
    assert latest is not None
    assert latest.id == second.id
    assert latest.otp_hash == "h2"


def test_increment_attempts_and_update_status() -> None:
    repo = OtpChallengeRepository(session_factory=SessionLocal)
    expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=5)
    created = repo.create_or_replace_pending(
        email="v@example.com", otp_hash="h1", expires_at=expires_at
    )

    updated_attempts = repo.increment_verify_attempts(created.id)
    assert updated_attempts is not None
    assert updated_attempts.verify_attempts == 1

    updated_status = repo.update_status(created.id, OtpChallengeModel.Status.LOCKED)
    assert updated_status is not None
    assert updated_status.status == "locked"
