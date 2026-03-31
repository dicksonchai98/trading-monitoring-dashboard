"""Add bidask_metrics_1s table for stream processing persistence.

Revision ID: 20260321_01
Revises: 20260315_01
Create Date: 2026-03-21
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260321_01"
down_revision = "20260315_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "bidask_metrics_1s" not in tables:
        op.create_table(
            "bidask_metrics_1s",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(length=16), nullable=False),
            sa.Column("trade_date", sa.Date(), nullable=False),
            sa.Column("event_ts", sa.DateTime(timezone=True), nullable=False),
            sa.Column("bid", sa.Float(), nullable=True),
            sa.Column("ask", sa.Float(), nullable=True),
            sa.Column("spread", sa.Float(), nullable=True),
            sa.Column("mid", sa.Float(), nullable=True),
            sa.Column("bid_size", sa.Float(), nullable=True),
            sa.Column("ask_size", sa.Float(), nullable=True),
            sa.Column("metric_payload", sa.Text(), nullable=False),
            sa.UniqueConstraint("code", "event_ts", name="uq_bidask_metrics_1s_code_event_ts"),
        )
        op.create_index(
            "ix_bidask_metrics_1s_code", "bidask_metrics_1s", ["code"], unique=False
        )
        op.create_index(
            "ix_bidask_metrics_1s_trade_date",
            "bidask_metrics_1s",
            ["trade_date"],
            unique=False,
        )
        op.create_index(
            "ix_bidask_metrics_1s_event_ts", "bidask_metrics_1s", ["event_ts"], unique=False
        )
        op.create_index(
            "ix_bidask_metrics_1s_code_trade_date",
            "bidask_metrics_1s",
            ["code", "trade_date"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "bidask_metrics_1s" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("bidask_metrics_1s")}
        if "ix_bidask_metrics_1s_code_trade_date" in indexes:
            op.drop_index("ix_bidask_metrics_1s_code_trade_date", table_name="bidask_metrics_1s")
        if "ix_bidask_metrics_1s_event_ts" in indexes:
            op.drop_index("ix_bidask_metrics_1s_event_ts", table_name="bidask_metrics_1s")
        if "ix_bidask_metrics_1s_trade_date" in indexes:
            op.drop_index("ix_bidask_metrics_1s_trade_date", table_name="bidask_metrics_1s")
        if "ix_bidask_metrics_1s_code" in indexes:
            op.drop_index("ix_bidask_metrics_1s_code", table_name="bidask_metrics_1s")
        op.drop_table("bidask_metrics_1s")
