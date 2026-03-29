"""OTP service for email verification flows."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import timedelta
from secrets import randbelow
from typing import Callable

from app.config import (
    OTP_CHANNEL,
    OTP_FIXED_CODE_FOR_TESTS,
    OTP_MAX_VERIFY_ATTEMPTS,
    OTP_RESEND_COOLDOWN_SECONDS,
    OTP_TTL_SECONDS,
    OTP_VERIFICATION_TOKEN_TTL_SECONDS,
    SENDGRID_OTP_TEMPLATE_ID,
)
from app.models.email_outbox import EmailOutboxModel
from app.models.otp_challenge import OtpChallengeModel
from app.repositories.email_outbox_repository import EmailOutboxRepository
from app.repositories.otp_challenge_repository import OtpChallengeRepository
from app.repositories.otp_verification_token_repository import OtpVerificationTokenRepository
from app.repositories.user_repository import UserRepository
from app.services.otp_crypto import (
    generate_opaque_token,
    hash_opaque_token,
    hash_otp_code,
    verify_otp_code,
)
from app.services.rate_limiter import SimpleRateLimiter
from app.utils.time import ensure_utc, utcnow


def _default_otp_generator() -> str:
    if OTP_FIXED_CODE_FOR_TESTS and os.getenv("PYTEST_CURRENT_TEST"):
        return OTP_FIXED_CODE_FOR_TESTS
    return f"{randbelow(1_000_000):06d}"


def _is_valid_email(value: str) -> bool:
    local_domain = value.split("@")
    return len(local_domain) == 2 and bool(local_domain[0]) and bool(local_domain[1])


@dataclass
class OtpSendResult:
    challenge_id: str


class OtpThrottleError(ValueError):
    def __init__(self, reason: str, retry_after_seconds: int) -> None:
        super().__init__(reason)
        self.reason = reason
        self.retry_after_seconds = retry_after_seconds


class OtpService:
    def __init__(
        self,
        user_repository: UserRepository,
        challenge_repository: OtpChallengeRepository,
        token_repository: OtpVerificationTokenRepository,
        outbox_repository: EmailOutboxRepository,
        rate_limiter: SimpleRateLimiter,
        otp_generator: Callable[[], str] | None = None,
    ) -> None:
        self._user_repository = user_repository
        self._challenge_repository = challenge_repository
        self._token_repository = token_repository
        self._outbox_repository = outbox_repository
        self._rate_limiter = rate_limiter
        self._otp_generator = otp_generator or _default_otp_generator

    def send_otp(self, email: str, requester_ip: str) -> OtpSendResult:
        if OTP_CHANNEL != "email":
            raise ValueError("unsupported_channel")
        if not _is_valid_email(email):
            raise ValueError("invalid_email")
        if self._user_repository.get_by_username(email) is not None:
            raise ValueError("user_exists")
        allowed, retry_after = self._rate_limiter.check_request(
            f"otp:email:{email}", limit=5, window_seconds=3600
        )
        if not allowed:
            raise OtpThrottleError("rate_limited", retry_after)
        allowed, retry_after = self._rate_limiter.check_request(
            f"otp:ip:{requester_ip}", limit=20, window_seconds=3600
        )
        if not allowed:
            raise OtpThrottleError("rate_limited", retry_after)

        latest_pending = self._challenge_repository.get_latest_pending(email)
        if latest_pending is not None:
            elapsed = (utcnow() - ensure_utc(latest_pending.last_sent_at)).total_seconds()
            if elapsed < OTP_RESEND_COOLDOWN_SECONDS:
                raise OtpThrottleError(
                    "cooldown",
                    max(1, int(OTP_RESEND_COOLDOWN_SECONDS - elapsed)),
                )

        otp_code = self._otp_generator()
        expires_at = utcnow() + timedelta(seconds=OTP_TTL_SECONDS)
        challenge = self._challenge_repository.create_or_replace_pending(
            email=email,
            otp_hash=hash_otp_code(otp_code),
            expires_at=expires_at,
            max_attempts=OTP_MAX_VERIFY_ATTEMPTS,
        )
        self._outbox_repository.create_task(
            email_type=EmailOutboxModel.EmailType.OTP,
            recipient=email,
            template_name=SENDGRID_OTP_TEMPLATE_ID,
            payload_json={
                "challenge_id": challenge.id,
                "otp_code": otp_code,
                "expires_in_seconds": OTP_TTL_SECONDS,
            },
            idempotency_key=f"otp:{email}:{challenge.id}",
        )
        return OtpSendResult(challenge_id=challenge.id)

    def verify_otp(self, email: str, otp_code: str) -> str:
        if not _is_valid_email(email):
            raise ValueError("invalid_email")
        challenge = self._challenge_repository.get_latest_pending(email)
        if challenge is None:
            raise ValueError("challenge_not_found")
        if ensure_utc(challenge.expires_at) <= utcnow():
            self._challenge_repository.update_status(challenge.id, OtpChallengeModel.Status.EXPIRED)
            raise ValueError("expired")
        if challenge.verify_attempts >= challenge.max_attempts:
            self._challenge_repository.update_status(challenge.id, OtpChallengeModel.Status.LOCKED)
            raise ValueError("locked")

        if not verify_otp_code(otp_code, challenge.otp_hash):
            updated = self._challenge_repository.increment_verify_attempts(challenge.id)
            if updated is not None and updated.verify_attempts >= updated.max_attempts:
                self._challenge_repository.update_status(
                    challenge.id, OtpChallengeModel.Status.LOCKED
                )
            raise ValueError("invalid_otp")

        self._challenge_repository.update_status(challenge.id, OtpChallengeModel.Status.VERIFIED)
        raw_token = generate_opaque_token()
        self._token_repository.create_token(
            token_hash=hash_opaque_token(raw_token),
            challenge_id=challenge.id,
            email=email,
            purpose="register",
            expires_at=utcnow() + timedelta(seconds=OTP_VERIFICATION_TOKEN_TTL_SECONDS),
        )
        return raw_token

    def consume_verification_token(self, token: str, email: str) -> str:
        token_hash = hash_opaque_token(token)
        self.validate_verification_token(token, email)

        consumed = self._token_repository.consume_token(
            token_hash,
            email=email,
            purpose="register",
            not_expired_at=utcnow(),
        )
        if consumed is None:
            raise ValueError("invalid_verification_token")
        self._challenge_repository.update_status(
            consumed.challenge_id, OtpChallengeModel.Status.CONSUMED
        )
        return consumed.challenge_id

    def reset_rate_limits(self) -> None:
        self._rate_limiter.reset()

    def validate_verification_token(self, token: str, email: str):
        token_hash = hash_opaque_token(token)
        candidate = self._token_repository.get_by_token_hash(token_hash)
        if candidate is None:
            raise ValueError("invalid_verification_token")
        if candidate.email != email or candidate.purpose != "register":
            raise ValueError("invalid_verification_token")
        if ensure_utc(candidate.expires_at) <= utcnow():
            raise ValueError("expired_verification_token")
        if candidate.used_at is not None:
            raise ValueError("invalid_verification_token")
        return candidate
