"""Add event_second identity for bidask 1Hz persistence."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260407_01"
down_revision = "3232ba353b72"
branch_labels = None
depends_on = None


def _dialect_name() -> str:
    bind = op.get_bind()
    return bind.dialect.name if bind is not None else ""


def upgrade() -> None:
    with op.batch_alter_table("bidask_metrics_1s") as batch_op:
        batch_op.add_column(sa.Column("event_second", sa.DateTime(timezone=True), nullable=True))

    dialect = _dialect_name()
    if dialect == "postgresql":
        op.execute(
            sa.text(
                "UPDATE bidask_metrics_1s "
                "SET event_second = date_trunc('second', event_ts) "
                "WHERE event_second IS NULL"
            )
        )
    else:
        op.execute(
            sa.text(
                "UPDATE bidask_metrics_1s "
                "SET event_second = event_ts "
                "WHERE event_second IS NULL"
            )
        )

    with op.batch_alter_table("bidask_metrics_1s") as batch_op:
        batch_op.alter_column("event_second", nullable=False)
        batch_op.create_unique_constraint(
            "uq_bidask_metrics_1s_code_event_second", ["code", "event_second"]
        )


def downgrade() -> None:
    with op.batch_alter_table("bidask_metrics_1s") as batch_op:
        batch_op.drop_constraint("uq_bidask_metrics_1s_code_event_second", type_="unique")
        batch_op.drop_column("event_second")

