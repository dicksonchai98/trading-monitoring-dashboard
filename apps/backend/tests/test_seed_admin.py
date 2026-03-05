from __future__ import annotations

from app.db.session import SessionLocal
from app.repositories.user_repository import UserRepository
from scripts.seed_admin import seed_admin


def test_seed_admin_is_idempotent(monkeypatch) -> None:
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    monkeypatch.setenv("ADMIN_PASSWORD", "admin-pass")

    created_first = seed_admin()
    created_second = seed_admin()

    repo = UserRepository(session_factory=SessionLocal)
    user = repo.get_by_username("admin")

    assert created_first == 1
    assert created_second == 0
    assert user is not None
    assert user.role == "admin"
