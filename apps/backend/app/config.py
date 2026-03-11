"""Runtime configuration for backend MVP."""

from __future__ import annotations

import os
from dataclasses import dataclass

ACCESS_TOKEN_TTL_SECONDS = int(os.getenv("ACCESS_TOKEN_TTL_SECONDS", str(60 * 60)))
REFRESH_TOKEN_TTL_SECONDS = int(os.getenv("REFRESH_TOKEN_TTL_SECONDS", str(60 * 60 * 24 * 7)))
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
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
SHIOAJI_API_KEY = os.getenv("SHIOAJI_API_KEY", "")
SHIOAJI_SECRET_KEY = os.getenv("SHIOAJI_SECRET_KEY", "")
SHIOAJI_SIMULATION = _env_bool("SHIOAJI_SIMULATION", True)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

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
AGGREGATOR_SERIES_FIELDS = _env_list(
    "AGGREGATOR_SERIES_FIELDS",
    ["bid", "ask", "mid", "spread", "delta_1s"],
)

BACKFILL_MAX_CONCURRENCY = _env_int("BACKFILL_MAX_CONCURRENCY", 2)
BACKFILL_RETRY_MAX_ATTEMPTS = _env_int("BACKFILL_RETRY_MAX_ATTEMPTS", 3)
BACKFILL_RETRY_BACKOFF_SECONDS = _env_int("BACKFILL_RETRY_BACKOFF_SECONDS", 1)
BACKFILL_MAX_RANGE_DAYS = _env_int("BACKFILL_MAX_RANGE_DAYS", 366)
BACKFILL_WORKER_POLL_INTERVAL_SECONDS = _env_int("BACKFILL_WORKER_POLL_INTERVAL_SECONDS", 5)
BACKFILL_HEARTBEAT_INTERVAL_SECONDS = _env_int("BACKFILL_HEARTBEAT_INTERVAL_SECONDS", 30)
BACKFILL_FETCH_MIN_INTERVAL_SECONDS = _env_int("BACKFILL_FETCH_MIN_INTERVAL_SECONDS", 1)


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
