from __future__ import annotations

import pytest

from app.db.session import SessionLocal
from app.repositories.user_repository import UserRepository


def test_create_user_duplicate_username_raises() -> None:
    repo = UserRepository(session_factory=SessionLocal)
    repo.create_user(username="dup-user", password_hash="h1", role="user")

    with pytest.raises(ValueError, match="user_exists"):
        repo.create_user(username="dup-user", password_hash="h2", role="user")

