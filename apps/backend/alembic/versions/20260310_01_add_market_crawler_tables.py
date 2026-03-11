"""Add crawler jobs and market crawler tables.

Revision ID: 20260310_01
Revises: 20260309_01
Create Date: 2026-03-10
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260310_01"
down_revision = "20260309_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "crawler_jobs" not in tables:
        op.create_table(
            "crawler_jobs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("parent_job_id", sa.Integer(), nullable=True),
            sa.Column("correlation_id", sa.String(length=64), nullable=True),
            sa.Column("dataset_code", sa.String(length=128), nullable=False),
            sa.Column("target_date", sa.Date(), nullable=True),
            sa.Column("range_start", sa.Date(), nullable=True),
            sa.Column("range_end", sa.Date(), nullable=True),
            sa.Column("trigger_type", sa.String(length=32), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("rows_fetched", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("rows_normalized", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("rows_persisted", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("error_category", sa.String(length=64), nullable=True),
            sa.Column("error_stage", sa.String(length=32), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index(
            "ix_crawler_jobs_dataset_target",
            "crawler_jobs",
            ["dataset_code", "target_date"],
            unique=False,
        )
        op.create_index(
            "ix_crawler_jobs_status",
            "crawler_jobs",
            ["status"],
            unique=False,
        )
        op.create_index(
            "ix_crawler_jobs_created_at",
            "crawler_jobs",
            ["created_at"],
            unique=False,
        )

    if "market_open_interest_daily" not in tables:
        op.create_table(
            "market_open_interest_daily",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("data_date", sa.Date(), nullable=False),
            sa.Column("market_code", sa.String(length=32), nullable=False),
            sa.Column("instrument_code", sa.String(length=32), nullable=False),
            sa.Column("entity_code", sa.String(length=32), nullable=False),
            sa.Column("long_trade_oi", sa.Integer(), nullable=False),
            sa.Column("short_trade_oi", sa.Integer(), nullable=False),
            sa.Column("net_trade_oi", sa.Integer(), nullable=False),
            sa.Column("long_trade_amount_k", sa.Numeric(20, 2), nullable=False),
            sa.Column("short_trade_amount_k", sa.Numeric(20, 2), nullable=False),
            sa.Column("net_trade_amount_k", sa.Numeric(20, 2), nullable=False),
            sa.Column("long_open_interest", sa.Integer(), nullable=False),
            sa.Column("short_open_interest", sa.Integer(), nullable=False),
            sa.Column("net_open_interest", sa.Integer(), nullable=False),
            sa.Column("long_open_interest_amount_k", sa.Numeric(20, 2), nullable=False),
            sa.Column("short_open_interest_amount_k", sa.Numeric(20, 2), nullable=False),
            sa.Column("net_open_interest_amount_k", sa.Numeric(20, 2), nullable=False),
            sa.Column("source", sa.String(length=64), nullable=False),
            sa.Column("parser_version", sa.String(length=32), nullable=False),
            sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint(
                "data_date",
                "market_code",
                "instrument_code",
                "entity_code",
                "source",
                name="uq_market_open_interest_daily_key",
            ),
        )

    if "crawler_raw_payloads" not in tables:
        op.create_table(
            "crawler_raw_payloads",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("job_id", sa.Integer(), nullable=False),
            sa.Column("dataset_code", sa.String(length=128), nullable=False),
            sa.Column("target_date", sa.Date(), nullable=True),
            sa.Column("source_name", sa.String(length=128), nullable=False),
            sa.Column("content_type", sa.String(length=128), nullable=False),
            sa.Column("payload_text", sa.Text(), nullable=False),
            sa.Column("payload_hash", sa.String(length=64), nullable=False),
            sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "crawler_raw_payloads" in tables:
        op.drop_table("crawler_raw_payloads")

    if "market_open_interest_daily" in tables:
        op.drop_table("market_open_interest_daily")

    if "crawler_jobs" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("crawler_jobs")}
        if "ix_crawler_jobs_dataset_target" in indexes:
            op.drop_index("ix_crawler_jobs_dataset_target", table_name="crawler_jobs")
        if "ix_crawler_jobs_status" in indexes:
            op.drop_index("ix_crawler_jobs_status", table_name="crawler_jobs")
        if "ix_crawler_jobs_created_at" in indexes:
            op.drop_index("ix_crawler_jobs_created_at", table_name="crawler_jobs")
        op.drop_table("crawler_jobs")
