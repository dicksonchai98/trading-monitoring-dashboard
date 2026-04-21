from __future__ import annotations

import pytest
from app.config import validate_stripe_settings
from app.services.stripe_provider import StripeProvider


def test_validate_stripe_settings_rejects_publishable_secret_key(monkeypatch) -> None:
    monkeypatch.setenv("STRIPE_SECRET_KEY", "pk_test_123")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_local")
    monkeypatch.setenv("STRIPE_PRICE_ID", "price_local")
    monkeypatch.setenv("STRIPE_SUCCESS_URL", "https://example.com/success")
    monkeypatch.setenv("STRIPE_CANCEL_URL", "https://example.com/cancel")

    with pytest.raises(RuntimeError, match="STRIPE_SECRET_KEY"):
        validate_stripe_settings()


def test_validate_stripe_settings_rejects_invalid_webhook_secret(monkeypatch) -> None:
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "bad_secret")
    monkeypatch.setenv("STRIPE_PRICE_ID", "price_local")
    monkeypatch.setenv("STRIPE_SUCCESS_URL", "https://example.com/success")
    monkeypatch.setenv("STRIPE_CANCEL_URL", "https://example.com/cancel")

    with pytest.raises(RuntimeError, match="STRIPE_WEBHOOK_SECRET"):
        validate_stripe_settings()


def test_stripe_provider_rejects_non_secret_key() -> None:
    with pytest.raises(ValueError, match="secret"):
        StripeProvider(secret_key="pk_test_123")
