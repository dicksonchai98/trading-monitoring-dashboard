"""merge 20260321 and 20260323 heads

Revision ID: 509fd9fd5f53
Revises: 20260321_01, 20260323_01
Create Date: 2026-04-02 20:04:44.942846
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '509fd9fd5f53'
down_revision = ('20260321_01', '20260323_01')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

