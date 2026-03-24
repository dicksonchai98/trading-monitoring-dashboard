from __future__ import annotations

import hmac
from unittest.mock import patch

from app.services.otp_crypto import (
    generate_opaque_token,
    hash_opaque_token,
    hash_otp_code,
    verify_otp_code,
)


def test_hash_and_verify_otp_constant_time() -> None:
    digest = hash_otp_code("123456")
    with patch(
        "app.services.otp_crypto.hmac.compare_digest", wraps=hmac.compare_digest
    ) as compare_mock:
        assert verify_otp_code("123456", digest) is True
        assert verify_otp_code("654321", digest) is False
    assert compare_mock.call_count == 2


def test_otp_and_verification_token_hashes_are_domain_separated() -> None:
    value = "same-input"
    otp_hash = hash_otp_code(value)
    token_hash = hash_opaque_token(value)
    assert otp_hash != token_hash


def test_generate_opaque_token_is_hashable_and_randomized() -> None:
    token_a = generate_opaque_token()
    token_b = generate_opaque_token()
    assert token_a
    assert token_b
    assert token_a != token_b
    assert len(token_a) >= 32
    assert len(token_b) >= 32
    assert isinstance(hash_opaque_token(token_a), str)
    assert isinstance(hash_opaque_token(token_b), str)
