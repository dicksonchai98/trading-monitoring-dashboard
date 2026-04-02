"""Runtime configuration for backend MVP."""

from __future__ import annotations

import os
from dataclasses import dataclass

ACCESS_TOKEN_TTL_SECONDS = int(os.getenv("ACCESS_TOKEN_TTL_SECONDS", str(60 * 60)))
REFRESH_TOKEN_TTL_SECONDS = int(os.getenv("REFRESH_TOKEN_TTL_SECONDS", str(60 * 60 * 24 * 7)))
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
OTP_HASH_SECRET = os.getenv("OTP_HASH_SECRET", "dev-otp-secret-change-me")
OPAQUE_TOKEN_HASH_SECRET = os.getenv(
    "OPAQUE_TOKEN_HASH_SECRET",
    "dev-opaque-token-secret-change-me",
)
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "refresh_token")


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    return int(raw)


def _env_optional_int(name: str) -> int | None:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return None
    return int(raw)


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


INGESTOR_ENABLED = _env_bool("INGESTOR_ENABLED", False)
INGESTOR_ENV = os.getenv("INGESTOR_ENV", "dev")
INGESTOR_CODE = os.getenv("INGESTOR_CODE", "MTX")
INGESTOR_QUOTE_TYPES = _env_list("INGESTOR_QUOTE_TYPES", ["tick", "bidask"])
INGESTOR_QUEUE_MAXSIZE = _env_int("INGESTOR_QUEUE_MAXSIZE", 1024)
INGESTOR_STREAM_MAXLEN = _env_int("INGESTOR_STREAM_MAXLEN", 100000)
INGESTOR_REDIS_RETRY_ATTEMPTS = _env_int("INGESTOR_REDIS_RETRY_ATTEMPTS", 3)
INGESTOR_REDIS_RETRY_BACKOFF_MS = _env_int("INGESTOR_REDIS_RETRY_BACKOFF_MS", 50)
INGESTOR_RECONNECT_MAX_SECONDS = _env_int("INGESTOR_RECONNECT_MAX_SECONDS", 30)
INGESTOR_SPOT_SYMBOLS_FILE = os.getenv("INGESTOR_SPOT_SYMBOLS_FILE", "infra/config/stock150.txt")
INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT = _env_int("INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT", 150)
INGESTOR_SPOT_REQUIRED = _env_bool("INGESTOR_SPOT_REQUIRED", False)
SHIOAJI_API_KEY = os.getenv("SHIOAJI_API_KEY", "")
SHIOAJI_SECRET_KEY = os.getenv("SHIOAJI_SECRET_KEY", "")
SHIOAJI_SIMULATION = _env_bool("SHIOAJI_SIMULATION", True)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
OTP_CHANNEL = os.getenv("OTP_CHANNEL", "email")
OTP_TTL_SECONDS = _env_int("OTP_TTL_SECONDS", 300)
OTP_MAX_VERIFY_ATTEMPTS = _env_int("OTP_MAX_VERIFY_ATTEMPTS", 5)
OTP_RESEND_COOLDOWN_SECONDS = _env_int("OTP_RESEND_COOLDOWN_SECONDS", 60)
OTP_SEND_MAX_RETRIES = _env_int("OTP_SEND_MAX_RETRIES", 3)
NOTIFICATION_SEND_MAX_RETRIES = _env_int("NOTIFICATION_SEND_MAX_RETRIES", 5)
OTP_VERIFICATION_TOKEN_TTL_SECONDS = _env_int("OTP_VERIFICATION_TOKEN_TTL_SECONDS", 600)
OTP_FIXED_CODE_FOR_TESTS = os.getenv("OTP_FIXED_CODE_FOR_TESTS", "")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "")
SENDGRID_OTP_TEMPLATE_ID = os.getenv("SENDGRID_OTP_TEMPLATE_ID", "otp_verification")
SENDGRID_WEBHOOK_SIGNING_KEY = os.getenv("SENDGRID_WEBHOOK_SIGNING_KEY", "")
EMAIL_STREAM_KEY = os.getenv("EMAIL_STREAM_KEY", "email:outbox:stream")
EMAIL_STREAM_GROUP = os.getenv("EMAIL_STREAM_GROUP", "email:worker")
EMAIL_STREAM_CONSUMER = os.getenv("EMAIL_STREAM_CONSUMER", "email-worker-1")

AGGREGATOR_ENABLED = _env_bool("AGGREGATOR_ENABLED", False)
AGGREGATOR_ENV = os.getenv("AGGREGATOR_ENV", INGESTOR_ENV)
AGGREGATOR_CODE = os.getenv("AGGREGATOR_CODE", INGESTOR_CODE)
AGGREGATOR_TICK_GROUP = os.getenv("AGGREGATOR_TICK_GROUP", "agg:tick")
AGGREGATOR_BIDASK_GROUP = os.getenv("AGGREGATOR_BIDASK_GROUP", "agg:bidask")
AGGREGATOR_TICK_CONSUMER = os.getenv("AGGREGATOR_TICK_CONSUMER", "agg-tick-1")
AGGREGATOR_BIDASK_CONSUMER = os.getenv("AGGREGATOR_BIDASK_CONSUMER", "agg-bidask-1")
AGGREGATOR_READ_COUNT = _env_int("AGGREGATOR_READ_COUNT", 100)
AGGREGATOR_BLOCK_MS = _env_int("AGGREGATOR_BLOCK_MS", 1000)
AGGREGATOR_CLAIM_IDLE_MS = _env_int("AGGREGATOR_CLAIM_IDLE_MS", 30000)
AGGREGATOR_CLAIM_COUNT = _env_int("AGGREGATOR_CLAIM_COUNT", 100)
AGGREGATOR_STATE_TTL_SECONDS = _env_int("AGGREGATOR_STATE_TTL_SECONDS", 60 * 60 * 24)
AGGREGATOR_DB_SINK_BATCH_SIZE = _env_int("AGGREGATOR_DB_SINK_BATCH_SIZE", 100)
AGGREGATOR_DB_SINK_RETRY_BACKOFF_SECONDS = float(
    os.getenv("AGGREGATOR_DB_SINK_RETRY_BACKOFF_SECONDS", "0.5")
)
AGGREGATOR_DB_SINK_MAX_RETRIES = _env_int("AGGREGATOR_DB_SINK_MAX_RETRIES", 5)
AGGREGATOR_DB_SINK_DEAD_LETTER_MAXLEN = _env_int("AGGREGATOR_DB_SINK_DEAD_LETTER_MAXLEN", 10000)
AGGREGATOR_BLOCKING_WARN_MS = _env_int("AGGREGATOR_BLOCKING_WARN_MS", 200)
AGGREGATOR_SERIES_FIELDS = _env_list(
    "AGGREGATOR_SERIES_FIELDS",
    ["bid", "ask", "mid", "spread", "delta_1s"],
)
AGGREGATOR_WORKER_ROLE = os.getenv("AGGREGATOR_WORKER_ROLE", "all")

LATEST_STATE_ENABLED = _env_bool("LATEST_STATE_ENABLED", False)
LATEST_STATE_ENV = os.getenv("LATEST_STATE_ENV", INGESTOR_ENV)
LATEST_STATE_GROUP = os.getenv("LATEST_STATE_GROUP", "latest-state:spot")
LATEST_STATE_CONSUMER = os.getenv("LATEST_STATE_CONSUMER", "latest-state-1")
LATEST_STATE_READ_COUNT = _env_int("LATEST_STATE_READ_COUNT", 200)
LATEST_STATE_BLOCK_MS = _env_int("LATEST_STATE_BLOCK_MS", 1000)
LATEST_STATE_CLAIM_IDLE_MS = _env_int("LATEST_STATE_CLAIM_IDLE_MS", 30000)
LATEST_STATE_CLAIM_COUNT = _env_int("LATEST_STATE_CLAIM_COUNT", 200)
LATEST_STATE_TTL_SECONDS = _env_int("LATEST_STATE_TTL_SECONDS", 3600)
LATEST_STATE_FLUSH_INTERVAL_MS = _env_int("LATEST_STATE_FLUSH_INTERVAL_MS", 500)
LATEST_STATE_FLUSH_BATCH_SIZE = _env_int("LATEST_STATE_FLUSH_BATCH_SIZE", 200)

BACKFILL_MAX_CONCURRENCY = _env_int("BACKFILL_MAX_CONCURRENCY", 2)
BACKFILL_RETRY_MAX_ATTEMPTS = _env_int("BACKFILL_RETRY_MAX_ATTEMPTS", 3)
BACKFILL_RETRY_BACKOFF_SECONDS = _env_int("BACKFILL_RETRY_BACKOFF_SECONDS", 1)
BACKFILL_MAX_RANGE_DAYS = _env_int("BACKFILL_MAX_RANGE_DAYS", 366)
BACKFILL_WORKER_POLL_INTERVAL_SECONDS = _env_int("BACKFILL_WORKER_POLL_INTERVAL_SECONDS", 5)
BACKFILL_HEARTBEAT_INTERVAL_SECONDS = _env_int("BACKFILL_HEARTBEAT_INTERVAL_SECONDS", 30)
BACKFILL_FETCH_MIN_INTERVAL_SECONDS = _env_int("BACKFILL_FETCH_MIN_INTERVAL_SECONDS", 1)

SERVING_ENV = os.getenv("SERVING_ENV", INGESTOR_ENV)
SERVING_DEFAULT_CODE = os.getenv("SERVING_DEFAULT_CODE", "")
SERVING_DEFAULT_KBAR_MINUTES = _env_int("SERVING_DEFAULT_KBAR_MINUTES", 240)
SERVING_DEFAULT_METRIC_SECONDS = _env_int("SERVING_DEFAULT_METRIC_SECONDS", 3600)
SERVING_RATE_LIMIT_PER_MIN = _env_int("SERVING_RATE_LIMIT_PER_MIN", 120)
SERVING_SSE_CONN_LIMIT = _env_int("SERVING_SSE_CONN_LIMIT", 3)
SERVING_HEARTBEAT_SECONDS = _env_int("SERVING_HEARTBEAT_SECONDS", 15)
SERVING_POLL_INTERVAL_MS = _env_int("SERVING_POLL_INTERVAL_MS", 1000)
SERVING_CORS_ALLOW_ORIGINS = _env_list(
    "SERVING_CORS_ALLOW_ORIGINS",
    ["*"],
)


@dataclass(frozen=True)
class StripeSettings:
    secret_key: str
    webhook_secret: str
    price_id: str
    plan_name: str
    price_amount: int | None
    price_currency: str
    price_interval: str
    success_url: str
    cancel_url: str
    portal_return_url: str


def get_stripe_settings() -> StripeSettings:
    return StripeSettings(
        secret_key=os.getenv("STRIPE_SECRET_KEY", ""),
        webhook_secret=os.getenv("STRIPE_WEBHOOK_SECRET", ""),
        price_id=os.getenv("STRIPE_PRICE_ID", ""),
        plan_name=os.getenv("STRIPE_PLAN_NAME", "Basic"),
        price_amount=_env_optional_int("STRIPE_PRICE_AMOUNT"),
        price_currency=os.getenv("STRIPE_PRICE_CURRENCY", "usd"),
        price_interval=os.getenv("STRIPE_PRICE_INTERVAL", "month"),
        success_url=os.getenv("STRIPE_SUCCESS_URL", ""),
        cancel_url=os.getenv("STRIPE_CANCEL_URL", ""),
        portal_return_url=os.getenv(
            "STRIPE_PORTAL_RETURN_URL", os.getenv("STRIPE_SUCCESS_URL", "")
        ),
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
    if not settings.secret_key.startswith("sk_"):
        raise RuntimeError("invalid STRIPE_SECRET_KEY: expected key starting with 'sk_'")
    if not settings.webhook_secret.startswith("whsec_"):
        raise RuntimeError(
            "invalid STRIPE_WEBHOOK_SECRET: expected key starting with 'whsec_'"
        )
