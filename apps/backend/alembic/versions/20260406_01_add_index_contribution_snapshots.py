"""Add index contribution snapshot tables.

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

    if "index_contribution_snapshot_1m" not in tables:
        op.create_table(
            "index_contribution_snapshot_1m",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("index_code", sa.String(length=16), nullable=False),
            sa.Column("trade_date", sa.Date(), nullable=False),
            sa.Column("minute_ts", sa.DateTime(timezone=True), nullable=False),
            sa.Column("symbol", sa.String(length=16), nullable=False),
            sa.Column("symbol_name", sa.String(length=64), nullable=False),
            sa.Column("sector", sa.String(length=64), nullable=False),
            sa.Column("last_price", sa.Float(), nullable=False),
            sa.Column("prev_close", sa.Float(), nullable=False),
            sa.Column("weight", sa.Float(), nullable=False),
            sa.Column("pct_change", sa.Float(), nullable=False),
            sa.Column("contribution_points", sa.Float(), nullable=False),
            sa.Column("rank_top", sa.Integer(), nullable=True),
            sa.Column("rank_bottom", sa.Integer(), nullable=True),
            sa.Column("weight_version", sa.String(length=64), nullable=True),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.UniqueConstraint(
                "index_code",
                "minute_ts",
                "symbol",
                name="uq_index_contribution_snapshot_1m_index_code_minute_ts_symbol",
            ),
        )
        op.create_index(
            "ix_index_contribution_snapshot_1m_index_code_trade_date",
            "index_contribution_snapshot_1m",
            ["index_code", "trade_date"],
            unique=False,
        )

    if "index_contribution_ranking_1m" not in tables:
        op.create_table(
            "index_contribution_ranking_1m",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("index_code", sa.String(length=16), nullable=False),
            sa.Column("trade_date", sa.Date(), nullable=False),
            sa.Column("minute_ts", sa.DateTime(timezone=True), nullable=False),
            sa.Column("ranking_type", sa.String(length=16), nullable=False),
            sa.Column("rank_no", sa.Integer(), nullable=False),
            sa.Column("symbol", sa.String(length=16), nullable=False),
            sa.Column("symbol_name", sa.String(length=64), nullable=False),
            sa.Column("sector", sa.String(length=64), nullable=False),
            sa.Column("contribution_points", sa.Float(), nullable=False),
            sa.Column("weight_version", sa.String(length=64), nullable=True),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.UniqueConstraint(
                "index_code",
                "minute_ts",
                "ranking_type",
                "rank_no",
                name="uq_index_contribution_ranking_1m_index_code_minute_ts_type_rank",
            ),
        )
        op.create_index(
            "ix_index_contribution_ranking_1m_index_code_trade_date",
            "index_contribution_ranking_1m",
            ["index_code", "trade_date"],
            unique=False,
        )

    if "sector_contribution_snapshot_1m" not in tables:
        op.create_table(
            "sector_contribution_snapshot_1m",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("index_code", sa.String(length=16), nullable=False),
            sa.Column("trade_date", sa.Date(), nullable=False),
            sa.Column("minute_ts", sa.DateTime(timezone=True), nullable=False),
            sa.Column("sector", sa.String(length=64), nullable=False),
            sa.Column("contribution_points", sa.Float(), nullable=False),
            sa.Column("weight_version", sa.String(length=64), nullable=True),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.UniqueConstraint(
                "index_code",
                "minute_ts",
                "sector",
                name="uq_sector_contribution_snapshot_1m_index_code_minute_ts_sector",
            ),
        )
        op.create_index(
            "ix_sector_contribution_snapshot_1m_index_code_trade_date",
            "sector_contribution_snapshot_1m",
            ["index_code", "trade_date"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "sector_contribution_snapshot_1m" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("sector_contribution_snapshot_1m")}
        if "ix_sector_contribution_snapshot_1m_index_code_trade_date" in indexes:
            op.drop_index(
                "ix_sector_contribution_snapshot_1m_index_code_trade_date",
                table_name="sector_contribution_snapshot_1m",
            )
        op.drop_table("sector_contribution_snapshot_1m")

    if "index_contribution_ranking_1m" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("index_contribution_ranking_1m")}
        if "ix_index_contribution_ranking_1m_index_code_trade_date" in indexes:
            op.drop_index(
                "ix_index_contribution_ranking_1m_index_code_trade_date",
                table_name="index_contribution_ranking_1m",
            )
        op.drop_table("index_contribution_ranking_1m")

    if "index_contribution_snapshot_1m" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("index_contribution_snapshot_1m")}
        if "ix_index_contribution_snapshot_1m_index_code_trade_date" in indexes:
            op.drop_index(
                "ix_index_contribution_snapshot_1m_index_code_trade_date",
                table_name="index_contribution_snapshot_1m",
            )
        op.drop_table("index_contribution_snapshot_1m")

