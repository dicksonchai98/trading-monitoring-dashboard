"""Structured logging helpers for historical backfill runtime."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from app.config import SHIOAJI_API_KEY, SHIOAJI_SECRET_KEY


def redact_secrets(value: str) -> str:
    redacted = value
    for secret in (SHIOAJI_API_KEY, SHIOAJI_SECRET_KEY):
        if secret:
            redacted = redacted.replace(secret, "***")
    return redacted


@dataclass(frozen=True)
class BackfillLogContext:
    job_id: int | None
    job_type: str
    code: str
    chunk_cursor: str | None
    status: str
    elapsed_ms: int | None = None


class BackfillLoggerAdapter(logging.LoggerAdapter):
    def process(self, msg: str, kwargs: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        extra = kwargs.setdefault("extra", {})
        extra.setdefault("job_id", self.extra.get("job_id"))
        extra.setdefault("job_type", self.extra.get("job_type"))
        extra.setdefault("code", self.extra.get("code"))
        extra.setdefault("chunk_cursor", self.extra.get("chunk_cursor"))
        extra.setdefault("status", self.extra.get("status"))
        extra.setdefault("elapsed_ms", self.extra.get("elapsed_ms"))
        return redact_secrets(str(msg)), kwargs


def get_backfill_logger(name: str, context: BackfillLogContext) -> BackfillLoggerAdapter:
    return BackfillLoggerAdapter(logging.getLogger(name), context.__dict__)
