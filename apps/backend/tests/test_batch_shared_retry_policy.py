from __future__ import annotations

import pytest
from app.modules.batch_shared.retry.errors import ErrorCategory
from app.modules.batch_shared.retry.policy import RetryPolicy


def test_retry_policy_retries_recoverable_error() -> None:
    calls: list[int] = []
    retries: list[ErrorCategory] = []

    def operation() -> str:
        calls.append(1)
        if len(calls) < 3:
            raise TimeoutError("transient")
        return "ok"

    def on_retry(attempt: int, category: ErrorCategory) -> None:
        retries.append(category)
        assert attempt == len(retries)

    policy = RetryPolicy(max_attempts=3, backoff_seconds=0)
    result = policy.run(operation, on_retry)

    assert result == "ok"
    assert len(calls) == 3
    assert retries == [ErrorCategory.NETWORK, ErrorCategory.NETWORK]


def test_retry_policy_does_not_retry_non_recoverable() -> None:
    policy = RetryPolicy(max_attempts=3, backoff_seconds=0)

    def operation() -> None:
        raise ValueError("bad-input")

    with pytest.raises(ValueError):
        policy.run(operation, lambda *_: None)
