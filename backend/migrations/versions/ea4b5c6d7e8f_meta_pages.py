"""meta_pages + meta_lead_events tables (Facebook Lead Ads)

Revision ID: ea4b5c6d7e8f
Revises: ce2f3a4b5c6d
Create Date: 2026-10-20 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ea4b5c6d7e8f'
down_revision: Union[str, Sequence[str], None] = 'ce2f3a4b5c6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if not insp.has_table("meta_pages"):
        op.create_table(
            'meta_pages',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('page_id', sa.String(length=64), nullable=False, unique=True),
            sa.Column('page_name', sa.String(length=255), nullable=True),
            sa.Column('access_token', sa.Text(), nullable=False),
            sa.Column('source_label', sa.String(length=50), nullable=False, server_default='facebook'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('last_lead_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_meta_pages_page_id', 'meta_pages', ['page_id'])

    if not insp.has_table("meta_lead_events"):
        op.create_table(
            'meta_lead_events',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('leadgen_id', sa.String(length=128), nullable=False, unique=True),
            sa.Column('page_id', sa.String(length=64), nullable=True),
            sa.Column('form_id', sa.String(length=64), nullable=True),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
            sa.Column('detail', sa.String(length=255), nullable=True),
            sa.Column('lead_id', sa.Integer(), sa.ForeignKey('leads.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_meta_lead_events_leadgen_id', 'meta_lead_events', ['leadgen_id'])
        op.create_index('ix_meta_lead_events_page_id', 'meta_lead_events', ['page_id'])
        op.create_index('idx_meta_event_created', 'meta_lead_events', ['created_at'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if insp.has_table("meta_lead_events"):
        op.drop_index('idx_meta_event_created', table_name='meta_lead_events')
        op.drop_index('ix_meta_lead_events_page_id', table_name='meta_lead_events')
        op.drop_index('ix_meta_lead_events_leadgen_id', table_name='meta_lead_events')
        op.drop_table('meta_lead_events')

    if insp.has_table("meta_pages"):
        op.drop_index('ix_meta_pages_page_id', table_name='meta_pages')
        op.drop_table('meta_pages')
