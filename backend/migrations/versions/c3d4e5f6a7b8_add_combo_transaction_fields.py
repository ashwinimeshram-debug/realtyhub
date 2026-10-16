"""add combo fields to listing_transactions

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-16 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the featured-portion days and bundle discount for combined purchases."""
    op.add_column(
        'listing_transactions',
        sa.Column('featured_days', sa.Integer(), nullable=True, server_default='0'),
    )
    op.add_column(
        'listing_transactions',
        sa.Column('discount_percent', sa.Numeric(precision=5, scale=2), nullable=True, server_default='0'),
    )


def downgrade() -> None:
    """Drop the combo columns."""
    op.drop_column('listing_transactions', 'discount_percent')
    op.drop_column('listing_transactions', 'featured_days')
