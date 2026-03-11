from __future__ import annotations

from pathlib import Path


def test_initial_migration_file_exists() -> None:
    path = Path("alembic/versions/20260223_01_init_identity_tables.py")
    assert path.exists()


def test_stripe_billing_migration_file_exists() -> None:
    path = Path("alembic/versions/20260225_01_add_stripe_billing_tables.py")
    assert path.exists()


def test_kbars_migration_file_exists() -> None:
    path = Path("alembic/versions/20260305_01_add_kbars_1m.py")
    assert path.exists()


def test_batch_job_checkpoint_migration_file_exists() -> None:
    path = Path("alembic/versions/20260309_02_add_batch_job_checkpoint_columns.py")
    assert path.exists()


def test_historical_backfill_migration_file_exists() -> None:
    path = Path("alembic/versions/20260309_03_add_historical_backfill_jobs_and_kbar_constraints.py")
    assert path.exists()
