"""Retry policy helpers."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import TypeVar

from app.modules.batch_shared.retry.errors import ErrorCategory, classify_error, is_recoverable

T = TypeVar("T")


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int
    backoff_seconds: int

    def run(self, operation: Callable[[], T], on_retry: Callable[[int, ErrorCategory], None]) -> T:
        attempt = 0
        while True:
            try:
                return operation()
            except Exception as err:
                attempt += 1
                category = classify_error(err)
                if not is_recoverable(category) or attempt >= self.max_attempts:
                    raise
                on_retry(attempt, category)
                time.sleep(self.backoff_seconds**attempt)
