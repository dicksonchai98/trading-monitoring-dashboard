"""Add market_summary_1m table for market summary worker.

Revision ID: 20260406_01
Revises: 20260323_01
Create Date: 2026-04-06
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260406_01"
down_revision = "20260323_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "market_summary_1m" not in tables:
        op.create_table(
            "market_summary_1m",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("market_code", sa.String(length=16), nullable=False),
            sa.Column("trade_date", sa.Date(), nullable=False),
            sa.Column("minute_ts", sa.DateTime(timezone=True), nullable=False),
            sa.Column("index_value", sa.Float(), nullable=False),
            sa.Column("cumulative_turnover", sa.Float(), nullable=False),
            sa.Column("completion_ratio", sa.Float(), nullable=False),
            sa.Column("estimated_turnover", sa.Float(), nullable=True),
            sa.Column("payload", sa.Text(), nullable=False),
            sa.UniqueConstraint(
                "market_code", "minute_ts", name="uq_market_summary_1m_code_minute_ts"
            ),
        )
        op.create_index("ix_market_summary_1m_market_code", "market_summary_1m", ["market_code"])
        op.create_index("ix_market_summary_1m_trade_date", "market_summary_1m", ["trade_date"])
        op.create_index("ix_market_summary_1m_minute_ts", "market_summary_1m", ["minute_ts"])
        op.create_index(
            "ix_market_summary_1m_code_trade_date",
            "market_summary_1m",
            ["market_code", "trade_date"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "market_summary_1m" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("market_summary_1m")}
        if "ix_market_summary_1m_code_trade_date" in indexes:
            op.drop_index("ix_market_summary_1m_code_trade_date", table_name="market_summary_1m")
        if "ix_market_summary_1m_minute_ts" in indexes:
            op.drop_index("ix_market_summary_1m_minute_ts", table_name="market_summary_1m")
        if "ix_market_summary_1m_trade_date" in indexes:
            op.drop_index("ix_market_summary_1m_trade_date", table_name="market_summary_1m")
        if "ix_market_summary_1m_market_code" in indexes:
            op.drop_index("ix_market_summary_1m_market_code", table_name="market_summary_1m")
        op.drop_table("market_summary_1m")
