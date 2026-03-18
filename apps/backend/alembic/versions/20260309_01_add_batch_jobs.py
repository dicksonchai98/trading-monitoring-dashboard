"""Add batch_jobs tracking table.

Revision ID: 20260309_01
Revises: 20260305_01
Create Date: 2026-03-09
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260309_01"
down_revision = "20260305_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "batch_jobs" not in tables:
        op.create_table(
            "batch_jobs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("job_type", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=16), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("rows_processed", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("metadata_json", sa.JSON(), nullable=True),
        )
        op.create_index("ix_batch_jobs_status", "batch_jobs", ["status"], unique=False)
        op.create_index("ix_batch_jobs_job_type", "batch_jobs", ["job_type"], unique=False)
        op.create_index("ix_batch_jobs_created_at", "batch_jobs", ["created_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "batch_jobs" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("batch_jobs")}
        if "ix_batch_jobs_status" in indexes:
            op.drop_index("ix_batch_jobs_status", table_name="batch_jobs")
        if "ix_batch_jobs_job_type" in indexes:
            op.drop_index("ix_batch_jobs_job_type", table_name="batch_jobs")
        if "ix_batch_jobs_created_at" in indexes:
            op.drop_index("ix_batch_jobs_created_at", table_name="batch_jobs")
        op.drop_table("batch_jobs")
