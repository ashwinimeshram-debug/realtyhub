"""add listed_by to properties

Revision ID: a1b2c3d4e5f6
Revises: 9c1a2b3d4e5f
Create Date: 2026-10-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '9c1a2b3d4e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the listed_by role (owner | agent | broker) to properties."""
    op.add_column('properties', sa.Column('listed_by', sa.String(length=20), nullable=True, server_default='owner'))


def downgrade() -> None:
    """Drop the listed_by column."""
    op.drop_column('properties', 'listed_by')
