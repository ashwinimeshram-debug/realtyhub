"""lead transfers history + connect-form intake fields + assigned_to index

Revision ID: bd1e2f3a4b5c
Revises: f6a7b8c9d0e1
Create Date: 2026-10-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bd1e2f3a4b5c'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if not insp.has_table("lead_transfers"):
        op.create_table(
            'lead_transfers',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('lead_id', sa.Integer(), sa.ForeignKey('leads.id', ondelete='CASCADE'), nullable=True),
            sa.Column('from_admin_id', sa.Integer(), sa.ForeignKey('admins.id', ondelete='SET NULL'), nullable=True),
            sa.Column('to_admin_id', sa.Integer(), sa.ForeignKey('admins.id', ondelete='SET NULL'), nullable=True),
            sa.Column('from_admin_name', sa.String(length=120), nullable=True),
            sa.Column('to_admin_name', sa.String(length=120), nullable=True),
            sa.Column('reason', sa.String(length=255), nullable=True),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('admins.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('idx_lead_transfer_lead', 'lead_transfers', ['lead_id'])
        op.create_index('idx_lead_transfer_created', 'lead_transfers', ['created_at'])

    if insp.has_table("leads"):
        lead_cols = {c['name'] for c in insp.get_columns('leads')}
        if 'timeframe' not in lead_cols:
            op.add_column('leads', sa.Column('timeframe', sa.String(length=50), nullable=True))
        if 'preferred_location' not in lead_cols:
            op.add_column('leads', sa.Column('preferred_location', sa.String(length=150), nullable=True))
        if 'budget' not in lead_cols:
            op.add_column('leads', sa.Column('budget', sa.String(length=50), nullable=True))

        lead_indexes = {ix['name'] for ix in insp.get_indexes('leads')}
        if 'idx_lead_assigned' not in lead_indexes:
            op.create_index('idx_lead_assigned', 'leads', ['assigned_to'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if insp.has_table("leads"):
        lead_indexes = {ix['name'] for ix in insp.get_indexes('leads')}
        if 'idx_lead_assigned' in lead_indexes:
            op.drop_index('idx_lead_assigned', table_name='leads')
        lead_cols = {c['name'] for c in insp.get_columns('leads')}
        for col in ('budget', 'preferred_location', 'timeframe'):
            if col in lead_cols:
                op.drop_column('leads', col)

    if insp.has_table("lead_transfers"):
        op.drop_index('idx_lead_transfer_created', table_name='lead_transfers')
        op.drop_index('idx_lead_transfer_lead', table_name='lead_transfers')
        op.drop_table('lead_transfers')
