"""Refresh token denylist backed by repository."""

from __future__ import annotations

from app.repositories.refresh_denylist_repository import RefreshDenylistRepository


class RefreshDenylist:
    def __init__(self, repo: RefreshDenylistRepository) -> None:
        self._repo = repo

    def add(self, jti: str, exp: int) -> None:
        self._repo.add(jti=jti, exp=exp)

    def contains(self, jti: str) -> bool:
        return self._repo.contains(jti)

    def cleanup(self) -> None:
        self._repo.cleanup()
