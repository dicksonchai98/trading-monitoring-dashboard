"""Minimal JWT-like token service using stdlib HMAC signing."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import uuid
from typing import Any


class TokenError(Exception):
    """Raised when a token is invalid or expired."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    pad_len = (-len(data)) % 4
    return base64.urlsafe_b64decode(data + ("=" * pad_len))


def _sign(signing_input: str, secret: str) -> str:
    digest = hmac.new(
        secret.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256
    ).digest()
    return _b64url_encode(digest)


def issue_token(claims: dict[str, Any], ttl_seconds: int, secret: str, token_type: str) -> str:
    now = int(time.time())
    payload = {
        **claims,
        "iat": now,
        "exp": now + ttl_seconds,
        "jti": str(uuid.uuid4()),
        "type": token_type,
    }
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _b64url_encode(
        json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header_b64}.{payload_b64}"
    signature = _sign(signing_input, secret)
    return f"{signing_input}.{signature}"


def verify_token(token: str, secret: str, expected_type: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise TokenError("tampered")

    signing_input = f"{parts[0]}.{parts[1]}"
    expected_sig = _sign(signing_input, secret)
    if not hmac.compare_digest(expected_sig, parts[2]):
        raise TokenError("tampered")

    try:
        payload = json.loads(_b64url_decode(parts[1]).decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as err:
        raise TokenError("tampered") from err

    if payload.get("type") != expected_type:
        raise TokenError("tampered")

    if int(payload.get("exp", 0)) <= int(time.time()):
        raise TokenError("expired")

    return payload
