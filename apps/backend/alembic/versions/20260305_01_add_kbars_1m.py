"""Add kbars_1m table for stream processing snapshots.

Revision ID: 20260305_01
Revises: 20260225_01
Create Date: 2026-03-05
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260305_01"
down_revision = "20260225_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "kbars_1m" not in tables:
        op.create_table(
            "kbars_1m",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(length=16), nullable=False),
            sa.Column("trade_date", sa.Date(), nullable=False),
            sa.Column("minute_ts", sa.DateTime(timezone=True), nullable=False),
            sa.Column("open", sa.Float(), nullable=False),
            sa.Column("high", sa.Float(), nullable=False),
            sa.Column("low", sa.Float(), nullable=False),
            sa.Column("close", sa.Float(), nullable=False),
            sa.Column("volume", sa.Float(), nullable=False, server_default=sa.text("0")),
        )
        op.create_index("ix_kbars_1m_code", "kbars_1m", ["code"], unique=False)
        op.create_index("ix_kbars_1m_trade_date", "kbars_1m", ["trade_date"], unique=False)
        op.create_index("ix_kbars_1m_minute_ts", "kbars_1m", ["minute_ts"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "kbars_1m" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("kbars_1m")}
        if "ix_kbars_1m_code" in indexes:
            op.drop_index("ix_kbars_1m_code", table_name="kbars_1m")
        if "ix_kbars_1m_trade_date" in indexes:
            op.drop_index("ix_kbars_1m_trade_date", table_name="kbars_1m")
        if "ix_kbars_1m_minute_ts" in indexes:
            op.drop_index("ix_kbars_1m_minute_ts", table_name="kbars_1m")
        op.drop_table("kbars_1m")
