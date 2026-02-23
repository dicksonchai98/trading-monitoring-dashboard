"""In-memory denylist store for refresh token JTI invalidation."""

from __future__ import annotations

import time


class RefreshDenylist:
    def __init__(self) -> None:
        self._entries: dict[str, int] = {}

    def add(self, jti: str, exp: int) -> None:
        self._entries[jti] = exp
        self.cleanup()

    def contains(self, jti: str) -> bool:
        self.cleanup()
        return jti in self._entries

    def cleanup(self) -> None:
        now = int(time.time())
        expired = [jti for jti, exp in self._entries.items() if exp <= now]
        for jti in expired:
            self._entries.pop(jti, None)

