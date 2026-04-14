"""add billing plans catalog

Revision ID: 20260404_01
Revises: 20260403_01
Create Date: 2026-04-04
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260404_01"
down_revision = "20260403_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "billing_plans",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.PrimaryKeyConstraint("id"),
    )

    op.execute(
        """
        INSERT INTO billing_plans (id, name, is_active, sort_order)
        VALUES
            ('free', 'Free', true, 0),
            ('basic', 'Basic', true, 1)
        """
    )


def downgrade() -> None:
    op.drop_table("billing_plans")
