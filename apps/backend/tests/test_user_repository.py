from __future__ import annotations

import pytest
from app.db.session import SessionLocal
from app.repositories.user_repository import UserRepository


def test_create_user_duplicate_user_id_raises() -> None:
    repo = UserRepository(session_factory=SessionLocal)
    repo.create_user(
        user_id="dup-user",
        email="dup1@example.com",
        password_hash="h1",
        role="user",
    )

    with pytest.raises(ValueError, match="user_exists"):
        repo.create_user(
            user_id="dup-user",
            email="dup2@example.com",
            password_hash="h2",
            role="user",
        )


def test_create_user_persists_user_id_and_email() -> None:
    repo = UserRepository(session_factory=SessionLocal)

    created = repo.create_user(
        user_id="trader01",
        email="trader01@example.com",
        password_hash="h1",
        role="user",
    )

    assert created.user_id == "trader01"
    assert created.email == "trader01@example.com"
