"""Simple in-memory metrics counters."""

from __future__ import annotations


class Metrics:
    def __init__(self) -> None:
        self.counters: dict[str, int] = {
            "login_success": 0,
            "login_failure": 0,
            "refresh_success": 0,
            "refresh_failure": 0,
            "refresh_denylist_hit": 0,
            "authorization_denied": 0,
            "sse_auth_failure": 0,
        }

    def inc(self, key: str) -> None:
        self.counters[key] = self.counters.get(key, 0) + 1

