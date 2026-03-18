from __future__ import annotations

from app.modules.batch_shared.retry.errors import (
    ErrorCategory,
    classify_error,
    error_context,
    is_recoverable,
)
from sqlalchemy.exc import SQLAlchemyError


def test_classify_error_categories() -> None:
    assert classify_error(TimeoutError("timeout")) == ErrorCategory.NETWORK
    assert classify_error(ConnectionError("conn")) == ErrorCategory.NETWORK
    assert classify_error(ValueError("bad")) == ErrorCategory.VALIDATION
    assert classify_error(TypeError("bad")) == ErrorCategory.VALIDATION
    assert classify_error(KeyError("missing")) == ErrorCategory.SOURCE_FORMAT
    assert classify_error(SQLAlchemyError("db")) == ErrorCategory.PERSISTENCE


def test_error_context_is_structured() -> None:
    err = ValueError("invalid")
    ctx = error_context(err)

    assert ctx["error_type"] == "ValueError"
    assert ctx["error_message"] == "invalid"
    assert ctx["category"] == ErrorCategory.VALIDATION.value


def test_is_recoverable_only_network_and_persistence() -> None:
    assert is_recoverable(ErrorCategory.NETWORK) is True
    assert is_recoverable(ErrorCategory.PERSISTENCE) is True
    assert is_recoverable(ErrorCategory.SOURCE_FORMAT) is False
    assert is_recoverable(ErrorCategory.VALIDATION) is False
