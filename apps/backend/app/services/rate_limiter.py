"""In-memory rate limiter and SSE connection guard for MVP."""

from __future__ import annotations

import threading
import time
from collections import deque


class SimpleRateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._requests: dict[str, deque[float]] = {}
        self._sse_active: dict[str, int] = {}

    def allow_request(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.time()
        with self._lock:
            queue = self._requests.setdefault(key, deque())
            cutoff = now - window_seconds
            while queue and queue[0] < cutoff:
                queue.popleft()
            if len(queue) >= limit:
                return False
            queue.append(now)
            return True

    def try_open_sse(self, key: str, limit: int) -> bool:
        with self._lock:
            current = self._sse_active.get(key, 0)
            if current >= limit:
                return False
            self._sse_active[key] = current + 1
            return True

    def close_sse(self, key: str) -> None:
        with self._lock:
            current = self._sse_active.get(key, 0)
            if current <= 1:
                self._sse_active.pop(key, None)
            else:
                self._sse_active[key] = current - 1
