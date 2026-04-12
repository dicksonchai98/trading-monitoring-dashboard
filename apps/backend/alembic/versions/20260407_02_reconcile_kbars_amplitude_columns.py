"""Reconcile missing kbars amplitude columns.

Revision ID: 20260407_02
Revises: 20260407_01
Create Date: 2026-04-07
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260407_02"
down_revision = "20260407_01"
branch_labels = None
depends_on = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "kbars_1m" not in tables:
        return

    columns = _column_names(inspector, "kbars_1m")
    if "amplitude" not in columns:
        op.add_column("kbars_1m", sa.Column("amplitude", sa.Float(), nullable=True))
    if "amplitude_pct" not in columns:
        op.add_column("kbars_1m", sa.Column("amplitude_pct", sa.Float(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "kbars_1m" not in tables:
        return

    columns = _column_names(inspector, "kbars_1m")
    if "amplitude_pct" in columns:
        op.drop_column("kbars_1m", "amplitude_pct")
    if "amplitude" in columns:
        op.drop_column("kbars_1m", "amplitude")

