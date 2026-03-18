"""Extend batch_jobs for shared admin queue orchestration.

Revision ID: 20260315_01
Revises: 20260312_02
Create Date: 2026-03-15
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260315_01"
down_revision = "20260312_02"
branch_labels = None
depends_on = None


def _columns(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "batch_jobs" not in tables:
        return

    columns = _columns(inspector, "batch_jobs")
    if "worker_type" not in columns:
        op.add_column(
            "batch_jobs",
            sa.Column(
                "worker_type",
                sa.String(length=64),
                nullable=False,
                server_default=sa.text("'batch-worker'"),
            ),
        )
    if "dedupe_key" not in columns:
        op.add_column("batch_jobs", sa.Column("dedupe_key", sa.String(length=128), nullable=True))

    indexes = {index["name"] for index in inspector.get_indexes("batch_jobs")}
    if "ix_batch_jobs_worker_type" not in indexes:
        op.create_index("ix_batch_jobs_worker_type", "batch_jobs", ["worker_type"], unique=False)
    if "ix_batch_jobs_worker_type_job_type_status" not in indexes:
        op.create_index(
            "ix_batch_jobs_worker_type_job_type_status",
            "batch_jobs",
            ["worker_type", "job_type", "status"],
            unique=False,
        )

    with op.batch_alter_table("batch_jobs") as batch_op:
        batch_op.alter_column("worker_type", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "batch_jobs" not in tables:
        return

    indexes = {index["name"] for index in inspector.get_indexes("batch_jobs")}
    if "ix_batch_jobs_worker_type_job_type_status" in indexes:
        op.drop_index("ix_batch_jobs_worker_type_job_type_status", table_name="batch_jobs")
    if "ix_batch_jobs_worker_type" in indexes:
        op.drop_index("ix_batch_jobs_worker_type", table_name="batch_jobs")

    columns = _columns(inspector, "batch_jobs")
    if "dedupe_key" in columns:
        op.drop_column("batch_jobs", "dedupe_key")
    if "worker_type" in columns:
        op.drop_column("batch_jobs", "worker_type")
