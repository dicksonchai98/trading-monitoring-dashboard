"""Retry error classification."""

from __future__ import annotations

from enum import Enum
from typing import Any

from sqlalchemy.exc import SQLAlchemyError


class ErrorCategory(str, Enum):
    NETWORK = "network"
    SOURCE_FORMAT = "source_format"
    VALIDATION = "validation"
    PERSISTENCE = "persistence"
    UNKNOWN = "unknown"


def classify_error(err: BaseException) -> ErrorCategory:
    if isinstance(err, (TimeoutError, ConnectionError, OSError)):
        return ErrorCategory.NETWORK
    if isinstance(err, (ValueError, TypeError)):
        return ErrorCategory.VALIDATION
    if isinstance(err, KeyError):
        return ErrorCategory.SOURCE_FORMAT
    if isinstance(err, SQLAlchemyError):
        return ErrorCategory.PERSISTENCE
    return ErrorCategory.UNKNOWN


def is_recoverable(category: ErrorCategory) -> bool:
    return category in {ErrorCategory.NETWORK, ErrorCategory.PERSISTENCE}


def error_context(err: BaseException) -> dict[str, Any]:
    return {
        "error_type": type(err).__name__,
        "error_message": str(err),
        "category": classify_error(err).value,
    }
