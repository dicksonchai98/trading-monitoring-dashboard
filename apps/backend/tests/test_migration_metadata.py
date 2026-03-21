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


def test_batch_job_status_length_migration_file_exists() -> None:
    path = Path("alembic/versions/20260312_01_expand_batch_job_status_length.py")
    assert path.exists()


def test_merge_head_migration_file_exists() -> None:
    path = Path("alembic/versions/20260312_02_merge_market_crawler_and_batch_status_heads.py")
    assert path.exists()


def test_batch_job_admin_queue_migration_file_exists() -> None:
    path = Path("alembic/versions/20260315_01_extend_batch_jobs_for_admin_queue.py")
    assert path.exists()


def test_bidask_metrics_migration_file_exists() -> None:
    path = Path("alembic/versions/20260321_01_add_bidask_metrics_1s.py")
    assert path.exists()


def test_otp_email_migration_file_exists() -> None:
    path = Path("alembic/versions/20260323_01_add_otp_and_email_pipeline_tables.py")
    assert path.exists()


def test_otp_email_ops_doc_exists() -> None:
    assert Path("docs/otp-email-ops.md").exists()
