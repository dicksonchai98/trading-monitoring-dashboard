from __future__ import annotations

import time

from app.db.session import SessionLocal
from app.repositories.refresh_denylist_repository import RefreshDenylistRepository


def test_refresh_denylist_contains_and_cleanup() -> None:
    repo = RefreshDenylistRepository(session_factory=SessionLocal)
    jti = "00000000-0000-0000-0000-000000000001"
    repo.add(jti=jti, exp=int(time.time()) + 10)
    assert repo.contains(jti)

    expired_jti = "00000000-0000-0000-0000-000000000002"
    repo.add(jti=expired_jti, exp=int(time.time()) - 1)
    assert not repo.contains(expired_jti)

