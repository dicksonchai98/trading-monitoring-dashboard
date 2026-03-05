"""Seed a default admin account if absent."""

from __future__ import annotations

import os
import sys

from app.db.session import SessionLocal
from app.repositories.user_repository import UserRepository
from app.security.passwords import hash_password


def seed_admin() -> int:
    username = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD")
    if not password:
        raise RuntimeError("ADMIN_PASSWORD is required")

    repo = UserRepository(session_factory=SessionLocal)
    existing = repo.get_by_username(username)
    if existing is not None:
        return 0

    repo.create_user(username=username, password_hash=hash_password(password), role="admin")
    return 1


if __name__ == "__main__":
    try:
        created = seed_admin()
        print(f"seed_admin created={created}")
    except Exception as exc:  # pragma: no cover
        print(f"seed_admin failed: {exc}", file=sys.stderr)
        raise
