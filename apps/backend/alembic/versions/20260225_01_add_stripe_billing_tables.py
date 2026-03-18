"""Add Stripe billing tables and user mapping fields.

Revision ID: 20260225_01
Revises: 20260223_01
Create Date: 2026-02-25
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260225_01"
down_revision = "20260223_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    user_indexes = {index["name"] for index in inspector.get_indexes("users")}

    if "stripe_customer_id" not in user_columns:
        op.add_column("users", sa.Column("stripe_customer_id", sa.String(length=255), nullable=True))

    if bind.dialect.name == "sqlite":
        if "ix_users_stripe_customer_id_unique" not in user_indexes:
            op.create_index(
                "ix_users_stripe_customer_id_unique",
                "users",
                ["stripe_customer_id"],
                unique=True,
            )
    else:
        user_uniques = {constraint["name"] for constraint in inspector.get_unique_constraints("users")}
        if "uq_users_stripe_customer_id" not in user_uniques:
            op.create_unique_constraint("uq_users_stripe_customer_id", "users", ["stripe_customer_id"])

    tables = set(inspector.get_table_names())

    if "subscriptions" not in tables:
        op.create_table(
            "subscriptions",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("stripe_customer_id", sa.String(length=255), nullable=True),
            sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True),
            sa.Column("stripe_price_id", sa.String(length=255), nullable=True),
            sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("entitlement_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id"),
            sa.UniqueConstraint("stripe_subscription_id"),
        )
        op.create_index("ix_subscriptions_stripe_customer_id", "subscriptions", ["stripe_customer_id"], unique=False)

    if "billing_events" not in tables:
        op.create_table(
            "billing_events",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("stripe_event_id", sa.String(length=255), nullable=False),
            sa.Column("event_type", sa.String(length=255), nullable=False),
            sa.Column("payload_hash", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("stripe_event_id"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "billing_events" in tables:
        op.drop_table("billing_events")
    if "subscriptions" in tables:
        subscription_indexes = {index["name"] for index in inspector.get_indexes("subscriptions")}
        if "ix_subscriptions_stripe_customer_id" in subscription_indexes:
            op.drop_index("ix_subscriptions_stripe_customer_id", table_name="subscriptions")
        op.drop_table("subscriptions")

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    user_indexes = {index["name"] for index in inspector.get_indexes("users")}
    if bind.dialect.name == "sqlite":
        if "ix_users_stripe_customer_id_unique" in user_indexes:
            op.drop_index("ix_users_stripe_customer_id_unique", table_name="users")
    else:
        user_uniques = {constraint["name"] for constraint in inspector.get_unique_constraints("users")}
        if "uq_users_stripe_customer_id" in user_uniques:
            op.drop_constraint("uq_users_stripe_customer_id", "users", type_="unique")

    if "stripe_customer_id" in user_columns:
        op.drop_column("users", "stripe_customer_id")
