from __future__ import annotations

from contextlib import suppress

from app.db.session import SessionLocal
from app.repositories.email_outbox_repository import EmailOutboxRepository
from app.repositories.otp_challenge_repository import OtpChallengeRepository
from app.repositories.otp_verification_token_repository import OtpVerificationTokenRepository
from app.repositories.user_repository import UserRepository
from app.services.otp_service import OtpService
from app.services.rate_limiter import SimpleRateLimiter


def build_otp_service() -> OtpService:
    return OtpService(
        user_repository=UserRepository(session_factory=SessionLocal),
        challenge_repository=OtpChallengeRepository(session_factory=SessionLocal),
        token_repository=OtpVerificationTokenRepository(session_factory=SessionLocal),
        outbox_repository=EmailOutboxRepository(session_factory=SessionLocal),
        rate_limiter=SimpleRateLimiter(),
        otp_generator=lambda: "123456",
    )


def test_send_otp_respects_cooldown() -> None:
    service = build_otp_service()
    service.send_otp("u@example.com", requester_ip="1.1.1.1")
    try:
        service.send_otp("u@example.com", requester_ip="1.1.1.1")
        raise AssertionError("expected cooldown error")
    except ValueError as err:
        assert str(err) == "cooldown"


def test_verify_otp_returns_one_time_token() -> None:
    service = build_otp_service()
    service.send_otp("u2@example.com", requester_ip="1.1.1.1")
    token = service.verify_otp("u2@example.com", "123456")
    assert token
    assert isinstance(token, str)
    assert len(token) >= 32


def test_verify_otp_invalid_attempts_eventually_lock() -> None:
    service = build_otp_service()
    service.send_otp("u3@example.com", requester_ip="1.1.1.1")

    for _ in range(5):
        with suppress(ValueError):
            service.verify_otp("u3@example.com", "000000")

    repo = OtpChallengeRepository(session_factory=SessionLocal)
    latest = repo.get_latest_pending("u3@example.com")
    assert latest is None


def test_consume_verification_token_rejects_wrong_email() -> None:
    service = build_otp_service()
    service.send_otp("u4@example.com", requester_ip="1.1.1.1")
    token = service.verify_otp("u4@example.com", "123456")
    try:
        service.consume_verification_token(token, email="other@example.com")
        raise AssertionError("expected invalid_verification_token")
    except ValueError as err:
        assert str(err) == "invalid_verification_token"
