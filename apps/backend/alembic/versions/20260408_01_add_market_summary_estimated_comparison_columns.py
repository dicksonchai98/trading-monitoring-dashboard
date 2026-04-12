"""Add estimated turnover comparison columns to market_summary_1m.

Revision ID: 20260408_01
Revises: 20260407_02
Create Date: 2026-04-08
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260408_01"
down_revision = "20260407_02"
branch_labels = None
depends_on = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "market_summary_1m" not in tables:
        return

    columns = _column_names(inspector, "market_summary_1m")
    if "yesterday_estimated_turnover" not in columns:
        op.add_column(
            "market_summary_1m",
            sa.Column("yesterday_estimated_turnover", sa.Float(), nullable=True),
        )
    if "estimated_turnover_diff" not in columns:
        op.add_column(
            "market_summary_1m",
            sa.Column("estimated_turnover_diff", sa.Float(), nullable=True),
        )
    if "estimated_turnover_ratio" not in columns:
        op.add_column(
            "market_summary_1m",
            sa.Column("estimated_turnover_ratio", sa.Float(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "market_summary_1m" not in tables:
        return

    columns = _column_names(inspector, "market_summary_1m")
    if "estimated_turnover_ratio" in columns:
        op.drop_column("market_summary_1m", "estimated_turnover_ratio")
    if "estimated_turnover_diff" in columns:
        op.drop_column("market_summary_1m", "estimated_turnover_diff")
    if "yesterday_estimated_turnover" in columns:
        op.drop_column("market_summary_1m", "yesterday_estimated_turnover")
