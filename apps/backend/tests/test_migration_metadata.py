from __future__ import annotations

from pathlib import Path


def test_initial_migration_file_exists() -> None:
    path = Path("alembic/versions/20260223_01_init_identity_tables.py")
    assert path.exists()

