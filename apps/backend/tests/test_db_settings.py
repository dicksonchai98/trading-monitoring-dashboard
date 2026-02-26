from __future__ import annotations

import os

import app.db.settings as db_settings


def test_get_database_url_from_env(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///./custom.db")
    assert db_settings.get_database_url() == "sqlite+pysqlite:///./custom.db"


def test_get_database_url_default(monkeypatch) -> None:
    current = os.environ.pop("DATABASE_URL", None)
    try:
        assert db_settings.get_database_url() == "sqlite+pysqlite:///./backend.db"
    finally:
        if current is not None:
            os.environ["DATABASE_URL"] = current

