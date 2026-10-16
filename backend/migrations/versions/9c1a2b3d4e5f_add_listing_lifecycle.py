"""add paid-listing lifecycle

Revision ID: 9c1a2b3d4e5f
Revises: 7eb39e37a50b
Create Date: 2026-10-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c1a2b3d4e5f'
down_revision: Union[str, Sequence[str], None] = '7eb39e37a50b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # --- properties: lifecycle columns + indexes ---
    op.add_column('properties', sa.Column('published_at', sa.DateTime(), nullable=True))
    op.add_column('properties', sa.Column('expires_at', sa.DateTime(), nullable=True))
    op.add_column('properties', sa.Column('last_renewed_at', sa.DateTime(), nullable=True))
    op.add_column('properties', sa.Column('renewal_count', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('properties', sa.Column('featured_until', sa.DateTime(), nullable=True))
    op.add_column('properties', sa.Column('payment_status', sa.String(length=20), nullable=True, server_default='unpaid'))
    op.create_index('idx_property_expires', 'properties', ['expires_at'], unique=False)
    op.create_index('idx_property_featured_until', 'properties', ['featured_until'], unique=False)
    op.create_index('idx_property_payment_status', 'properties', ['payment_status'], unique=False)

    # --- listing_transactions ---
    op.create_table(
        'listing_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=True),
        sa.Column('purpose', sa.String(length=20), nullable=False, server_default='listing'),
        sa.Column('transaction_type', sa.String(length=20), nullable=True),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(length=8), server_default='INR'),
        sa.Column('duration_days', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('provider', sa.String(length=20), server_default='mock'),
        sa.Column('provider_order_id', sa.String(length=120), nullable=True),
        sa.Column('provider_payment_id', sa.String(length=120), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='pending'),
        sa.Column('method', sa.String(length=20), server_default='online'),
        sa.Column('notes', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['owner_id'], ['owners.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_ltxn_property', 'listing_transactions', ['property_id'], unique=False)
    op.create_index('idx_ltxn_status', 'listing_transactions', ['status'], unique=False)
    op.create_index('idx_ltxn_created', 'listing_transactions', ['created_at'], unique=False)
    op.create_index(op.f('ix_listing_transactions_owner_id'), 'listing_transactions', ['owner_id'], unique=False)
    op.create_index(op.f('ix_listing_transactions_provider_order_id'), 'listing_transactions', ['provider_order_id'], unique=True)

    # --- listing_reminders ---
    op.create_table(
        'listing_reminders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False, server_default='expiry'),
        sa.Column('stage_days', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('property_id', 'kind', 'stage_days', name='uq_listing_reminder'),
    )
    op.create_index('idx_lrem_property', 'listing_reminders', ['property_id'], unique=False)

    # --- data backfill: grandfather existing approved listings as free ---
    # Existing approved listings keep their place: mark them waived so they stay
    # publicly visible once the payment gate turns on.
    op.execute(
        "UPDATE properties SET payment_status = 'waived', "
        "published_at = COALESCE(published_at, created_at) "
        "WHERE status = 'approved'"
    )
    # Owner-posted listings get a future expiry; staff/imported (owner_id NULL)
    # listings stay exempt (never expire).
    op.execute(
        "UPDATE properties SET expires_at = NOW() + (CASE "
        "WHEN LOWER(COALESCE(transaction_type, 'sell')) = 'rent' "
        "THEN INTERVAL '30 days' ELSE INTERVAL '90 days' END) "
        "WHERE status = 'approved' AND owner_id IS NOT NULL"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_lrem_property', table_name='listing_reminders')
    op.drop_table('listing_reminders')

    op.drop_index(op.f('ix_listing_transactions_provider_order_id'), table_name='listing_transactions')
    op.drop_index(op.f('ix_listing_transactions_owner_id'), table_name='listing_transactions')
    op.drop_index('idx_ltxn_created', table_name='listing_transactions')
    op.drop_index('idx_ltxn_status', table_name='listing_transactions')
    op.drop_index('idx_ltxn_property', table_name='listing_transactions')
    op.drop_table('listing_transactions')

    op.drop_index('idx_property_payment_status', table_name='properties')
    op.drop_index('idx_property_featured_until', table_name='properties')
    op.drop_index('idx_property_expires', table_name='properties')
    op.drop_column('properties', 'payment_status')
    op.drop_column('properties', 'featured_until')
    op.drop_column('properties', 'renewal_count')
    op.drop_column('properties', 'last_renewed_at')
    op.drop_column('properties', 'expires_at')
    op.drop_column('properties', 'published_at')
