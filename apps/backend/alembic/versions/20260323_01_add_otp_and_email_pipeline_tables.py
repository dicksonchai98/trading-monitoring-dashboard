"""Add OTP and email pipeline tables.

Revision ID: 20260323_01
Revises: 20260315_01
Create Date: 2026-03-23
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260323_01"
down_revision = "20260315_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    def _ensure_index(table_name: str, index_name: str, columns: list[str], unique: bool) -> None:
        existing_indexes = {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}
        if index_name not in existing_indexes:
            op.create_index(index_name, table_name, columns, unique=unique)

    if "otp_challenges" not in tables:
        op.create_table(
            "otp_challenges",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("otp_hash", sa.String(length=255), nullable=False),
            sa.Column("status", sa.String(length=16), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("verify_attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("max_attempts", sa.Integer(), nullable=False, server_default=sa.text("5")),
            sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    if "otp_challenges" in set(sa.inspect(bind).get_table_names()):
        _ensure_index("otp_challenges", "ix_otp_challenges_email", ["email"], unique=False)
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_otp_challenges_pending_email "
            "ON otp_challenges(email) WHERE status = 'pending'"
        )

    if "otp_verification_tokens" not in tables:
        op.create_table(
            "otp_verification_tokens",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("token_hash", sa.String(length=255), nullable=False),
            sa.Column("challenge_id", sa.String(length=36), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("purpose", sa.String(length=32), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["challenge_id"], ["otp_challenges.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token_hash"),
        )
    if "otp_verification_tokens" in set(sa.inspect(bind).get_table_names()):
        _ensure_index(
            "otp_verification_tokens",
            "ix_otp_verification_tokens_email",
            ["email"],
            unique=False,
        )
        _ensure_index(
            "otp_verification_tokens",
            "ix_otp_verification_tokens_active_lookup",
            ["email", "purpose", "used_at", "expires_at"],
            unique=False,
        )

    if "email_outbox" not in tables:
        op.create_table(
            "email_outbox",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("email_type", sa.String(length=32), nullable=False),
            sa.Column("recipient", sa.String(length=255), nullable=False),
            sa.Column("template_name", sa.String(length=128), nullable=False),
            sa.Column("payload_json", sa.JSON(), nullable=False),
            sa.Column("status", sa.String(length=16), nullable=False),
            sa.Column("retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("max_retry", sa.Integer(), nullable=False, server_default=sa.text("3")),
            sa.Column("idempotency_key", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    if "email_outbox" in set(sa.inspect(bind).get_table_names()):
        _ensure_index(
            "email_outbox",
            "ix_email_outbox_idempotency_key",
            ["idempotency_key"],
            unique=True,
        )

    if "email_delivery_logs" not in tables:
        op.create_table(
            "email_delivery_logs",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("outbox_id", sa.String(length=36), nullable=False),
            sa.Column("provider", sa.String(length=64), nullable=False),
            sa.Column("provider_message_id", sa.String(length=255), nullable=True),
            sa.Column("event_type", sa.String(length=64), nullable=False),
            sa.Column("result", sa.String(length=32), nullable=False),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("attempt_no", sa.Integer(), nullable=False, server_default=sa.text("1")),
            sa.Column("event_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("provider_payload_json", sa.JSON(), nullable=False),
            sa.ForeignKeyConstraint(["outbox_id"], ["email_outbox.id"]),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "email_delivery_logs" in tables:
        op.drop_table("email_delivery_logs")

    if "email_outbox" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("email_outbox")}
        if "ix_email_outbox_idempotency_key" in indexes:
            op.drop_index("ix_email_outbox_idempotency_key", table_name="email_outbox")
        op.drop_table("email_outbox")

    if "otp_verification_tokens" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("otp_verification_tokens")}
        if "ix_otp_verification_tokens_active_lookup" in indexes:
            op.drop_index(
                "ix_otp_verification_tokens_active_lookup",
                table_name="otp_verification_tokens",
            )
        if "ix_otp_verification_tokens_email" in indexes:
            op.drop_index("ix_otp_verification_tokens_email", table_name="otp_verification_tokens")
        op.drop_table("otp_verification_tokens")

    if "otp_challenges" in tables:
        indexes = {index["name"] for index in inspector.get_indexes("otp_challenges")}
        if "ux_otp_challenges_pending_email" in indexes:
            op.drop_index("ux_otp_challenges_pending_email", table_name="otp_challenges")
        if "ix_otp_challenges_email" in indexes:
            op.drop_index("ix_otp_challenges_email", table_name="otp_challenges")
        op.drop_table("otp_challenges")
