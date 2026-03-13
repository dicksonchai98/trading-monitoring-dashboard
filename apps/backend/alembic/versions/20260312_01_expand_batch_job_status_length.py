"""Expand batch_jobs.status length for long shared runtime statuses.

Revision ID: 20260312_01
Revises: 20260309_03
Create Date: 2026-03-12
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260312_01"
down_revision = "20260309_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "batch_jobs" not in tables:
        return

    with op.batch_alter_table("batch_jobs") as batch_op:
        batch_op.alter_column(
            "status",
            existing_type=sa.String(length=16),
            type_=sa.String(length=32),
            existing_nullable=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "batch_jobs" not in tables:
        return

    with op.batch_alter_table("batch_jobs") as batch_op:
        batch_op.alter_column(
            "status",
            existing_type=sa.String(length=32),
            type_=sa.String(length=16),
            existing_nullable=False,
        )
