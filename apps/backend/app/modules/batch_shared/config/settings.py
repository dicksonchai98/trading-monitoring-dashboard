"""Batch shared runtime settings."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    return int(raw)


def _env_str(name: str, default: str) -> str:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip()


@dataclass(frozen=True)
class BatchSettings:
    database_url: str
    worker_name: str
    retry_max_attempts: int
    retry_backoff_seconds: int
    log_level: str
    redis_url: str
    queue_block_timeout_seconds: int


def load_batch_settings() -> BatchSettings:
    return BatchSettings(
        database_url=_env_str("DATABASE_URL", "sqlite+pysqlite:///./backend.db"),
        worker_name=_env_str("WORKER_NAME", "batch-worker"),
        retry_max_attempts=_env_int("RETRY_MAX_ATTEMPTS", 3),
        retry_backoff_seconds=_env_int("RETRY_BACKOFF_SECONDS", 2),
        log_level=_env_str("LOG_LEVEL", "INFO"),
        redis_url=_env_str("REDIS_URL", "redis://localhost:6379/0"),
        queue_block_timeout_seconds=_env_int("QUEUE_BLOCK_TIMEOUT_SECONDS", 0),
    )
