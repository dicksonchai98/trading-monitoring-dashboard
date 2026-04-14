"""Add tick/bidask/spread extension columns.

Revision ID: 20260406_02
Revises: 20260406_01
Create Date: 2026-04-06
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260406_02"
down_revision = "20260406_01"
branch_labels = None
depends_on = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "kbars_1m" in tables:
        columns = _column_names(inspector, "kbars_1m")
        if "amplitude" not in columns:
            op.add_column("kbars_1m", sa.Column("amplitude", sa.Float(), nullable=True))
        if "amplitude_pct" not in columns:
            op.add_column("kbars_1m", sa.Column("amplitude_pct", sa.Float(), nullable=True))

    if "market_summary_1m" in tables:
        columns = _column_names(inspector, "market_summary_1m")
        if "futures_code" not in columns:
            op.add_column("market_summary_1m", sa.Column("futures_code", sa.String(length=16), nullable=True))
        if "futures_price" not in columns:
            op.add_column("market_summary_1m", sa.Column("futures_price", sa.Float(), nullable=True))
        if "spread" not in columns:
            op.add_column("market_summary_1m", sa.Column("spread", sa.Float(), nullable=True))
        if "spread_day_high" not in columns:
            op.add_column("market_summary_1m", sa.Column("spread_day_high", sa.Float(), nullable=True))
        if "spread_day_low" not in columns:
            op.add_column("market_summary_1m", sa.Column("spread_day_low", sa.Float(), nullable=True))
        if "spread_strength" not in columns:
            op.add_column("market_summary_1m", sa.Column("spread_strength", sa.Float(), nullable=True))
        if "spread_status" not in columns:
            op.add_column("market_summary_1m", sa.Column("spread_status", sa.String(length=32), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "market_summary_1m" in tables:
        columns = _column_names(inspector, "market_summary_1m")
        for col_name in (
            "spread_status",
            "spread_strength",
            "spread_day_low",
            "spread_day_high",
            "spread",
            "futures_price",
            "futures_code",
        ):
            if col_name in columns:
                op.drop_column("market_summary_1m", col_name)

    if "kbars_1m" in tables:
        columns = _column_names(inspector, "kbars_1m")
        if "amplitude_pct" in columns:
            op.drop_column("kbars_1m", "amplitude_pct")
        if "amplitude" in columns:
            op.drop_column("kbars_1m", "amplitude")
