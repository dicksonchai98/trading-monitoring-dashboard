"""Add checkpoint/resume columns to batch_jobs.

Revision ID: 20260309_02
Revises: 20260309_01
Create Date: 2026-03-09
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260309_02"
down_revision = "20260309_01"
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
    if "checkpoint_cursor" not in columns:
        op.add_column("batch_jobs", sa.Column("checkpoint_cursor", sa.Text(), nullable=True))
    if "processed_chunks" not in columns:
        op.add_column(
            "batch_jobs",
            sa.Column("processed_chunks", sa.Integer(), nullable=False, server_default=sa.text("0")),
        )
    if "total_chunks" not in columns:
        op.add_column("batch_jobs", sa.Column("total_chunks", sa.Integer(), nullable=True))
    if "last_heartbeat_at" not in columns:
        op.add_column("batch_jobs", sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "batch_jobs" not in tables:
        return

    columns = _columns(inspector, "batch_jobs")
    if "last_heartbeat_at" in columns:
        op.drop_column("batch_jobs", "last_heartbeat_at")
    if "total_chunks" in columns:
        op.drop_column("batch_jobs", "total_chunks")
    if "processed_chunks" in columns:
        op.drop_column("batch_jobs", "processed_chunks")
    if "checkpoint_cursor" in columns:
        op.drop_column("batch_jobs", "checkpoint_cursor")
