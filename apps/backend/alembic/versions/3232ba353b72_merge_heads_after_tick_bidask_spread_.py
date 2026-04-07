"""merge heads after tick bidask spread phase1

Revision ID: 3232ba353b72
Revises: 20260321_01, 20260406_02
Create Date: 2026-04-07 11:30:26.982056
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3232ba353b72'
down_revision = ('20260321_01', '20260406_02')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

