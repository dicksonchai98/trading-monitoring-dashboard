"""Add historical backfill jobs table and kbar uniqueness constraints.

Revision ID: 20260309_03
Revises: 20260309_02
Create Date: 2026-03-09
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260309_03"
down_revision = "20260309_02"
branch_labels = None
depends_on = None


def _index_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {index["name"] for index in inspector.get_indexes(table_name)}


def _columns(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _has_unique_constraint(
    inspector: sa.Inspector, table_name: str, expected_cols: tuple[str, ...]
) -> bool:
    target = tuple(expected_cols)
    for item in inspector.get_unique_constraints(table_name):
        if tuple(item.get("column_names", [])) == target:
            return True
    return False


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "kbars_1m" in tables:
        index_names = _index_names(inspector, "kbars_1m")
        if "ix_kbars_1m_code_trade_date" not in index_names:
            op.create_index("ix_kbars_1m_code_trade_date", "kbars_1m", ["code", "trade_date"])
        if not _has_unique_constraint(inspector, "kbars_1m", ("code", "minute_ts")):
            op.create_unique_constraint("uq_kbars_1m_code_minute_ts", "kbars_1m", ["code", "minute_ts"])

    if "historical_backfill_jobs" not in tables:
        op.create_table(
            "historical_backfill_jobs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("job_type", sa.String(length=64), nullable=False, server_default="historical_backfill"),
            sa.Column("code", sa.String(length=16), nullable=False),
            sa.Column("requested_start_date", sa.Date(), nullable=False),
            sa.Column("requested_end_date", sa.Date(), nullable=False),
            sa.Column("overwrite_mode", sa.String(length=16), nullable=False, server_default="closed_only"),
            sa.Column("status", sa.String(length=16), nullable=False),
            sa.Column("rows_written", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("rows_processed", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("rows_failed_validation", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("rows_skipped_conflict", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("processed_chunks", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("total_chunks", sa.Integer(), nullable=True),
            sa.Column("checkpoint_cursor", sa.Text(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_historical_backfill_jobs_status", "historical_backfill_jobs", ["status"])
        op.create_index("ix_historical_backfill_jobs_created_at", "historical_backfill_jobs", ["created_at"])
        op.create_index(
            "ix_historical_backfill_jobs_lookup",
            "historical_backfill_jobs",
            ["code", "requested_start_date", "requested_end_date", "overwrite_mode"],
        )

    if "historical_backfill_jobs" in set(sa.inspect(bind).get_table_names()):
        columns = _columns(sa.inspect(bind), "historical_backfill_jobs")
        if "id" in columns:
            # no-op to keep upgrade idempotent across environments
            pass


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "historical_backfill_jobs" in tables:
        index_names = _index_names(inspector, "historical_backfill_jobs")
        if "ix_historical_backfill_jobs_lookup" in index_names:
            op.drop_index("ix_historical_backfill_jobs_lookup", table_name="historical_backfill_jobs")
        if "ix_historical_backfill_jobs_created_at" in index_names:
            op.drop_index("ix_historical_backfill_jobs_created_at", table_name="historical_backfill_jobs")
        if "ix_historical_backfill_jobs_status" in index_names:
            op.drop_index("ix_historical_backfill_jobs_status", table_name="historical_backfill_jobs")
        op.drop_table("historical_backfill_jobs")

    if "kbars_1m" in tables:
        index_names = _index_names(inspector, "kbars_1m")
        if "ix_kbars_1m_code_trade_date" in index_names:
            op.drop_index("ix_kbars_1m_code_trade_date", table_name="kbars_1m")
        for item in inspector.get_unique_constraints("kbars_1m"):
            if item.get("name") == "uq_kbars_1m_code_minute_ts":
                op.drop_constraint("uq_kbars_1m_code_minute_ts", "kbars_1m", type_="unique")
                break
