"""Add quote_features_1m table.

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

    if "quote_features_1m" not in tables:
        op.create_table(
            "quote_features_1m",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(length=16), nullable=False),
            sa.Column("trade_date", sa.Date(), nullable=False),
            sa.Column("minute_ts", sa.DateTime(timezone=True), nullable=False),
            sa.Column("main_chip", sa.Float(), nullable=False),
            sa.Column("main_chip_day_high", sa.Float(), nullable=False),
            sa.Column("main_chip_day_low", sa.Float(), nullable=False),
            sa.Column("main_chip_strength", sa.Float(), nullable=False),
            sa.Column("long_short_force", sa.Float(), nullable=False),
            sa.Column("long_short_force_day_high", sa.Float(), nullable=False),
            sa.Column("long_short_force_day_low", sa.Float(), nullable=False),
            sa.Column("long_short_force_strength", sa.Float(), nullable=False),
            sa.Column("payload", sa.Text(), nullable=False),
            sa.UniqueConstraint("code", "minute_ts", name="uq_quote_features_1m_code_minute_ts"),
        )
        op.create_index("ix_quote_features_1m_code", "quote_features_1m", ["code"], unique=False)
        op.create_index(
            "ix_quote_features_1m_trade_date", "quote_features_1m", ["trade_date"], unique=False
        )
        op.create_index(
            "ix_quote_features_1m_minute_ts", "quote_features_1m", ["minute_ts"], unique=False
        )
        op.create_index(
            "ix_quote_features_1m_code_trade_date",
            "quote_features_1m",
            ["code", "trade_date"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "quote_features_1m" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("quote_features_1m")}
        if "ix_quote_features_1m_code_trade_date" in indexes:
            op.drop_index("ix_quote_features_1m_code_trade_date", table_name="quote_features_1m")
        if "ix_quote_features_1m_minute_ts" in indexes:
            op.drop_index("ix_quote_features_1m_minute_ts", table_name="quote_features_1m")
        if "ix_quote_features_1m_trade_date" in indexes:
            op.drop_index("ix_quote_features_1m_trade_date", table_name="quote_features_1m")
        if "ix_quote_features_1m_code" in indexes:
            op.drop_index("ix_quote_features_1m_code", table_name="quote_features_1m")
        op.drop_table("quote_features_1m")
