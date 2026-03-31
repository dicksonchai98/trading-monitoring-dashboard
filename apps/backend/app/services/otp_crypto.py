"""Crypto helpers for OTP and opaque verification tokens."""

from __future__ import annotations

import hashlib
import hmac
import secrets

from app.config import OPAQUE_TOKEN_HASH_SECRET, OTP_HASH_SECRET


def _hash_with_context(value: str, *, context: str, secret: str) -> str:
    # Prefixing context provides domain separation for different hash purposes.
    message = f"{context}:{value}".encode()
    return hmac.new(
        secret.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()


def hash_otp_code(otp_code: str) -> str:
    return _hash_with_context(otp_code, context="otp", secret=OTP_HASH_SECRET)


def verify_otp_code(otp_code: str, expected_hash: str) -> bool:
    actual_hash = hash_otp_code(otp_code)
    return hmac.compare_digest(actual_hash, expected_hash)


def generate_opaque_token() -> str:
    return secrets.token_urlsafe(32)


def hash_opaque_token(token: str) -> str:
    return _hash_with_context(token, context="verification-token", secret=OPAQUE_TOKEN_HASH_SECRET)
