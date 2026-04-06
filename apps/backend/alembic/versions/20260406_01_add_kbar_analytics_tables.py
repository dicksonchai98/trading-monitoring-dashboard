"""Add k-bar analytics backend tables.

Revision ID: 20260406_01
Revises: 20260323_01
Create Date: 2026-04-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260406_01"
down_revision = "20260323_01"
branch_labels = None
depends_on = None


def _index_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "kbar_daily_features" not in tables:
        op.create_table(
            "kbar_daily_features",
            sa.Column("code", sa.String(length=16), nullable=False),
            sa.Column("trade_date", sa.Date(), nullable=False),
            sa.Column("day_open", sa.Float(), nullable=False),
            sa.Column("day_high", sa.Float(), nullable=False),
            sa.Column("day_low", sa.Float(), nullable=False),
            sa.Column("day_close", sa.Float(), nullable=False),
            sa.Column("day_volume", sa.Float(), nullable=False, server_default=sa.text("0")),
            sa.Column("day_return", sa.Float(), nullable=False),
            sa.Column("day_range", sa.Float(), nullable=False),
            sa.Column("day_return_pct", sa.Float(), nullable=False),
            sa.Column("day_range_pct", sa.Float(), nullable=False),
            sa.Column("gap_from_prev_close", sa.Float(), nullable=False),
            sa.Column("close_position", sa.Float(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("code", "trade_date", name="pk_kbar_daily_features"),
        )
        op.create_index(
            "ix_kbar_daily_features_trade_date", "kbar_daily_features", ["trade_date"], unique=False
        )

    if "kbar_event_samples" not in tables:
        op.create_table(
            "kbar_event_samples",
            sa.Column("event_id", sa.String(length=64), nullable=False),
            sa.Column("code", sa.String(length=16), nullable=False),
            sa.Column("trade_date", sa.Date(), nullable=False),
            sa.Column("next_trade_date", sa.Date(), nullable=False),
            sa.Column("event_value", sa.Float(), nullable=False),
            sa.Column("event_day_return", sa.Float(), nullable=False),
            sa.Column("event_day_range", sa.Float(), nullable=False),
            sa.Column("next_day_open", sa.Float(), nullable=False),
            sa.Column("next_day_high", sa.Float(), nullable=False),
            sa.Column("next_day_low", sa.Float(), nullable=False),
            sa.Column("next_day_close", sa.Float(), nullable=False),
            sa.Column("next_day_return", sa.Float(), nullable=False),
            sa.Column("next_day_range", sa.Float(), nullable=False),
            sa.Column("next_day_gap", sa.Float(), nullable=False),
            sa.Column("next_day_category", sa.String(length=16), nullable=False),
            sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint(
                "event_id", "code", "trade_date", name="pk_kbar_event_samples"
            ),
        )
        op.create_index(
            "ix_kbar_event_samples_event_code_trade_date",
            "kbar_event_samples",
            ["event_id", "code", "trade_date"],
            unique=False,
        )
        op.create_index(
            "ix_kbar_event_samples_code_trade_date",
            "kbar_event_samples",
            ["code", "trade_date"],
            unique=False,
        )

    if "kbar_event_stats" not in tables:
        op.create_table(
            "kbar_event_stats",
            sa.Column("event_id", sa.String(length=64), nullable=False),
            sa.Column("code", sa.String(length=16), nullable=False),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("sample_count", sa.Integer(), nullable=False),
            sa.Column("up_count", sa.Integer(), nullable=False),
            sa.Column("down_count", sa.Integer(), nullable=False),
            sa.Column("flat_count", sa.Integer(), nullable=False),
            sa.Column("up_probability", sa.Float(), nullable=False),
            sa.Column("down_probability", sa.Float(), nullable=False),
            sa.Column("flat_probability", sa.Float(), nullable=False),
            sa.Column("avg_next_day_return", sa.Float(), nullable=False),
            sa.Column("median_next_day_return", sa.Float(), nullable=False),
            sa.Column("avg_next_day_range", sa.Float(), nullable=False),
            sa.Column("avg_next_day_gap", sa.Float(), nullable=False),
            sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint(
                "event_id", "code", "start_date", "end_date", "version", name="pk_kbar_event_stats"
            ),
            sa.UniqueConstraint(
                "event_id",
                "code",
                "start_date",
                "end_date",
                "computed_at",
                name="uq_kbar_event_stats_latest",
            ),
        )
        op.create_index(
            "ix_kbar_event_stats_event_code_computed",
            "kbar_event_stats",
            ["event_id", "code", "computed_at"],
            unique=False,
        )

    if "kbar_distribution_stats" not in tables:
        op.create_table(
            "kbar_distribution_stats",
            sa.Column("metric_id", sa.String(length=64), nullable=False),
            sa.Column("code", sa.String(length=16), nullable=False),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("sample_count", sa.Integer(), nullable=False),
            sa.Column("mean", sa.Float(), nullable=False),
            sa.Column("median", sa.Float(), nullable=False),
            sa.Column("min", sa.Float(), nullable=False),
            sa.Column("max", sa.Float(), nullable=False),
            sa.Column("p25", sa.Float(), nullable=False),
            sa.Column("p50", sa.Float(), nullable=False),
            sa.Column("p75", sa.Float(), nullable=False),
            sa.Column("p90", sa.Float(), nullable=False),
            sa.Column("p95", sa.Float(), nullable=False),
            sa.Column("histogram_json", sa.JSON(), nullable=False),
            sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint(
                "metric_id",
                "code",
                "start_date",
                "end_date",
                "version",
                name="pk_kbar_distribution_stats",
            ),
            sa.UniqueConstraint(
                "metric_id",
                "code",
                "start_date",
                "end_date",
                "computed_at",
                name="uq_kbar_distribution_stats_latest",
            ),
        )
        op.create_index(
            "ix_kbar_distribution_stats_metric_code_computed",
            "kbar_distribution_stats",
            ["metric_id", "code", "computed_at"],
            unique=False,
        )

    if "analytics_jobs" not in tables:
        op.create_table(
            "analytics_jobs",
            sa.Column("job_id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("job_type", sa.String(length=64), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
        )
        op.create_index(
            "ix_analytics_jobs_status_created_at",
            "analytics_jobs",
            ["status", "created_at"],
            unique=False,
        )
        op.create_index(
            "ix_analytics_jobs_job_type_created_at",
            "analytics_jobs",
            ["job_type", "created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "analytics_jobs" in tables:
        index_names = _index_names(inspector, "analytics_jobs")
        if "ix_analytics_jobs_job_type_created_at" in index_names:
            op.drop_index("ix_analytics_jobs_job_type_created_at", table_name="analytics_jobs")
        if "ix_analytics_jobs_status_created_at" in index_names:
            op.drop_index("ix_analytics_jobs_status_created_at", table_name="analytics_jobs")
        op.drop_table("analytics_jobs")

    if "kbar_distribution_stats" in tables:
        index_names = _index_names(inspector, "kbar_distribution_stats")
        if "ix_kbar_distribution_stats_metric_code_computed" in index_names:
            op.drop_index(
                "ix_kbar_distribution_stats_metric_code_computed",
                table_name="kbar_distribution_stats",
            )
        op.drop_table("kbar_distribution_stats")

    if "kbar_event_stats" in tables:
        index_names = _index_names(inspector, "kbar_event_stats")
        if "ix_kbar_event_stats_event_code_computed" in index_names:
            op.drop_index("ix_kbar_event_stats_event_code_computed", table_name="kbar_event_stats")
        op.drop_table("kbar_event_stats")

    if "kbar_event_samples" in tables:
        index_names = _index_names(inspector, "kbar_event_samples")
        if "ix_kbar_event_samples_code_trade_date" in index_names:
            op.drop_index("ix_kbar_event_samples_code_trade_date", table_name="kbar_event_samples")
        if "ix_kbar_event_samples_event_code_trade_date" in index_names:
            op.drop_index(
                "ix_kbar_event_samples_event_code_trade_date", table_name="kbar_event_samples"
            )
        op.drop_table("kbar_event_samples")

    if "kbar_daily_features" in tables:
        index_names = _index_names(inspector, "kbar_daily_features")
        if "ix_kbar_daily_features_trade_date" in index_names:
            op.drop_index("ix_kbar_daily_features_trade_date", table_name="kbar_daily_features")
        op.drop_table("kbar_daily_features")
