"""Error helpers for historical backfill retry classification."""

from __future__ import annotations

from enum import Enum


class ErrorClass(str, Enum):
    RETRYABLE = "retryable"
    NON_RETRYABLE = "non_retryable"


def classify_error(err: Exception) -> ErrorClass:
    if isinstance(err, ValueError):
        return ErrorClass.NON_RETRYABLE
    if isinstance(err, (TimeoutError, ConnectionError)):
        return ErrorClass.RETRYABLE

    message = str(err).lower()
    retryable_tokens = ("timeout", "temporar", "throttle", "rate limit", "network", "retry")
    if any(token in message for token in retryable_tokens):
        return ErrorClass.RETRYABLE
    return ErrorClass.NON_RETRYABLE
