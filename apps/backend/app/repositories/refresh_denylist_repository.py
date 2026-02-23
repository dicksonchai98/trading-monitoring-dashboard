"""Repository for refresh token denylist."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.refresh_denylist import RefreshTokenDenylistModel


def _to_utc(exp_timestamp: int) -> datetime:
    return datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)


class RefreshDenylistRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def add(self, jti: str, exp: int) -> None:
        with self._session_factory() as session:
            row = RefreshTokenDenylistModel(jti=jti, expires_at=_to_utc(exp))
            session.add(row)
            session.commit()
        self.cleanup()

    def contains(self, jti: str) -> bool:
        self.cleanup()
        with self._session_factory() as session:
            stmt = select(RefreshTokenDenylistModel.id).where(RefreshTokenDenylistModel.jti == jti)
            return session.execute(stmt).first() is not None

    def cleanup(self) -> None:
        with self._session_factory() as session:
            now = datetime.now(tz=timezone.utc)
            stmt = delete(RefreshTokenDenylistModel).where(RefreshTokenDenylistModel.expires_at <= now)
            session.execute(stmt)
            session.commit()

