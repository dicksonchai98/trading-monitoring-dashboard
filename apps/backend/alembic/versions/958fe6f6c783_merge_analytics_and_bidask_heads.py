"""merge analytics and bidask
  heads

Revision ID: 958fe6f6c783
Revises: 20260321_01, 20260406_01
Create Date: 2026-04-07 11:02:45.523768
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '958fe6f6c783'
down_revision = ('20260321_01', '20260406_01')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

