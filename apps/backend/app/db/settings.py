"""Database runtime settings."""

from __future__ import annotations

import os


def get_database_url() -> str:
    """Return database URL from env, defaulting to local SQLite for development/tests."""
    return os.getenv("DATABASE_URL", "sqlite+pysqlite:///./backend.db")
