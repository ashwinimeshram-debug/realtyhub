"""add rate_limit_counters table for shared (db://) rate-limit storage

Revision ID: f6a7b8c9d0e1
Revises: d4e5f6a7b8c9
Create Date: 2026-10-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the shared rate-limit counter table.

    Development runs ``db.create_all()``, which may already have created this
    table, so skip creation when it is present.
    """
    bind = op.get_bind()
    if sa.inspect(bind).has_table("rate_limit_counters"):
        return

    op.create_table(
        'rate_limit_counters',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('key', sa.String(length=255), nullable=False),
        sa.Column('value', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('expires_at', sa.Float(), nullable=False),
    )
    op.create_index(
        'ix_rate_limit_counters_key', 'rate_limit_counters', ['key'], unique=True
    )
    op.create_index(
        'idx_rate_limit_counters_expires', 'rate_limit_counters', ['expires_at']
    )


def downgrade() -> None:
    """Drop the shared rate-limit counter table."""
    bind = op.get_bind()
    if not sa.inspect(bind).has_table("rate_limit_counters"):
        return

    op.drop_index('idx_rate_limit_counters_expires', table_name='rate_limit_counters')
    op.drop_index('ix_rate_limit_counters_key', table_name='rate_limit_counters')
    op.drop_table('rate_limit_counters')
