"""Runtime configuration for backend MVP."""

from __future__ import annotations

import os
from dataclasses import dataclass

ACCESS_TOKEN_TTL_SECONDS = int(os.getenv("ACCESS_TOKEN_TTL_SECONDS", str(60 * 60)))
REFRESH_TOKEN_TTL_SECONDS = int(os.getenv("REFRESH_TOKEN_TTL_SECONDS", str(60 * 60 * 24 * 7)))
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "refresh_token")


@dataclass(frozen=True)
class StripeSettings:
    secret_key: str
    webhook_secret: str
    price_id: str
    success_url: str
    cancel_url: str
    portal_return_url: str


def get_stripe_settings() -> StripeSettings:
    return StripeSettings(
        secret_key=os.getenv("STRIPE_SECRET_KEY", ""),
        webhook_secret=os.getenv("STRIPE_WEBHOOK_SECRET", ""),
        price_id=os.getenv("STRIPE_PRICE_ID", ""),
        success_url=os.getenv("STRIPE_SUCCESS_URL", ""),
        cancel_url=os.getenv("STRIPE_CANCEL_URL", ""),
        portal_return_url=os.getenv("STRIPE_PORTAL_RETURN_URL", os.getenv("STRIPE_SUCCESS_URL", "")),
    )


def validate_stripe_settings() -> None:
    settings = get_stripe_settings()
    missing = [
        name
        for name, value in (
            ("STRIPE_SECRET_KEY", settings.secret_key),
            ("STRIPE_WEBHOOK_SECRET", settings.webhook_secret),
            ("STRIPE_PRICE_ID", settings.price_id),
            ("STRIPE_SUCCESS_URL", settings.success_url),
            ("STRIPE_CANCEL_URL", settings.cancel_url),
        )
        if not value
    ]
    if missing:
        missing_env = ", ".join(missing)
        raise RuntimeError(f"missing required stripe configuration: {missing_env}")
