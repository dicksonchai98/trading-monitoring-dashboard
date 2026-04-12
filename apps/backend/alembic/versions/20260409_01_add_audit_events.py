"""Add audit_events table for persistent admin/security audit logs.

Revision ID: 20260409_01
Revises: 20260408_01
Create Date: 2026-04-09
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260409_01"
down_revision = "20260408_01"
branch_labels = None
depends_on = None


def _table_names(inspector: sa.Inspector) -> set[str]:
    return set(inspector.get_table_names())


def _index_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {item["name"] for item in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = _table_names(inspector)

    if "audit_events" not in tables:
        op.create_table(
            "audit_events",
            sa.Column("id", sa.BigInteger(), nullable=False, autoincrement=True),
            sa.Column("event_type", sa.String(length=128), nullable=False),
            sa.Column("path", sa.String(length=255), nullable=False),
            sa.Column("actor", sa.String(length=128), nullable=True),
            sa.Column("role", sa.String(length=32), nullable=True),
            sa.Column("result", sa.String(length=16), nullable=True),
            sa.Column(
                "metadata",
                sa.dialects.postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        inspector = sa.inspect(bind)

    indexes = _index_names(inspector, "audit_events")
    if "ix_audit_events_created_at_desc" not in indexes:
        op.create_index(
            "ix_audit_events_created_at_desc",
            "audit_events",
            [sa.text("created_at DESC")],
            unique=False,
        )
    if "ix_audit_events_event_type_created_at" not in indexes:
        op.create_index(
            "ix_audit_events_event_type_created_at",
            "audit_events",
            ["event_type", sa.text("created_at DESC")],
            unique=False,
        )
    if "ix_audit_events_actor_created_at" not in indexes:
        op.create_index(
            "ix_audit_events_actor_created_at",
            "audit_events",
            ["actor", sa.text("created_at DESC")],
            unique=False,
            postgresql_where=sa.text("actor IS NOT NULL"),
        )
    if "ix_audit_events_result_created_at" not in indexes:
        op.create_index(
            "ix_audit_events_result_created_at",
            "audit_events",
            ["result", sa.text("created_at DESC")],
            unique=False,
            postgresql_where=sa.text("result IS NOT NULL"),
        )
    if "ix_audit_events_metadata_gin" not in indexes:
        op.create_index(
            "ix_audit_events_metadata_gin",
            "audit_events",
            ["metadata"],
            unique=False,
            postgresql_using="gin",
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = _table_names(inspector)
    if "audit_events" not in tables:
        return

    indexes = _index_names(inspector, "audit_events")
    if "ix_audit_events_metadata_gin" in indexes:
        op.drop_index("ix_audit_events_metadata_gin", table_name="audit_events")
    if "ix_audit_events_result_created_at" in indexes:
        op.drop_index("ix_audit_events_result_created_at", table_name="audit_events")
    if "ix_audit_events_actor_created_at" in indexes:
        op.drop_index("ix_audit_events_actor_created_at", table_name="audit_events")
    if "ix_audit_events_event_type_created_at" in indexes:
        op.drop_index("ix_audit_events_event_type_created_at", table_name="audit_events")
    if "ix_audit_events_created_at_desc" in indexes:
        op.drop_index("ix_audit_events_created_at_desc", table_name="audit_events")
    op.drop_table("audit_events")
