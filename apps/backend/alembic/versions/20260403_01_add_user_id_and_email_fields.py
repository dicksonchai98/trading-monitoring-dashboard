"""add user_id and email identity fields

Revision ID: 20260403_01
Revises: 509fd9fd5f53
Create Date: 2026-04-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260403_01"
down_revision = "509fd9fd5f53"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("user_id", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("email", sa.String(length=320), nullable=True))
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))

    op.execute("UPDATE users SET user_id = username WHERE user_id IS NULL")
    op.execute("UPDATE users SET email = username WHERE email IS NULL")

    op.alter_column("users", "user_id", nullable=False)
    op.alter_column("users", "email", nullable=False)
    op.create_unique_constraint("uq_users_user_id", "users", ["user_id"])
    op.create_unique_constraint("uq_users_email", "users", ["email"])


def downgrade() -> None:
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_constraint("uq_users_user_id", "users", type_="unique")
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "email")
    op.drop_column("users", "user_id")
