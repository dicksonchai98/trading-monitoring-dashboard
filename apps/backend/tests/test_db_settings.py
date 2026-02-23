from __future__ import annotations

import os

from app.db.settings import get_database_url


def test_get_database_url_from_env(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///./custom.db")
    assert get_database_url() == "sqlite+pysqlite:///./custom.db"


def test_get_database_url_default() -> None:
    current = os.environ.pop("DATABASE_URL", None)
    try:
        assert get_database_url() == "sqlite+pysqlite:///./backend.db"
    finally:
        if current is not None:
            os.environ["DATABASE_URL"] = current

