"""coupons + coupon_redemptions tables and transaction coupon columns

Revision ID: ce2f3a4b5c6d
Revises: bd1e2f3a4b5c
Create Date: 2026-10-20 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ce2f3a4b5c6d'
down_revision: Union[str, Sequence[str], None] = 'bd1e2f3a4b5c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if not insp.has_table("coupons"):
        op.create_table(
            'coupons',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('code', sa.String(length=50), nullable=False, unique=True),
            sa.Column('description', sa.String(length=255), nullable=True),
            sa.Column('discount_type', sa.String(length=10), nullable=False, server_default='percent'),
            sa.Column('value', sa.Numeric(10, 2), nullable=False, server_default='0'),
            sa.Column('max_discount', sa.Numeric(10, 2), nullable=True),
            sa.Column('min_amount', sa.Numeric(10, 2), nullable=False, server_default='0'),
            sa.Column('applies_to', sa.String(length=15), nullable=False, server_default='all'),
            sa.Column('valid_from', sa.DateTime(), nullable=True),
            sa.Column('valid_until', sa.DateTime(), nullable=True),
            sa.Column('usage_limit', sa.Integer(), nullable=True),
            sa.Column('per_user_limit', sa.Integer(), nullable=True),
            sa.Column('used_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )

    if not insp.has_table("coupon_redemptions"):
        op.create_table(
            'coupon_redemptions',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('coupon_id', sa.Integer(), sa.ForeignKey('coupons.id', ondelete='CASCADE'), nullable=True),
            sa.Column('owner_id', sa.Integer(), sa.ForeignKey('owners.id', ondelete='SET NULL'), nullable=True),
            sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('listing_transactions.id', ondelete='SET NULL'), nullable=True),
            sa.Column('amount', sa.Numeric(10, 2), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('idx_coupon_redeem_coupon', 'coupon_redemptions', ['coupon_id'])
        op.create_index('idx_coupon_redeem_owner', 'coupon_redemptions', ['owner_id'])

    if insp.has_table("listing_transactions"):
        cols = {c['name'] for c in insp.get_columns('listing_transactions')}
        if 'coupon_id' not in cols:
            op.add_column('listing_transactions', sa.Column(
                'coupon_id', sa.Integer(), sa.ForeignKey('coupons.id', ondelete='SET NULL'), nullable=True))
        if 'coupon_code' not in cols:
            op.add_column('listing_transactions', sa.Column('coupon_code', sa.String(length=50), nullable=True))
        if 'coupon_discount' not in cols:
            op.add_column('listing_transactions', sa.Column('coupon_discount', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if insp.has_table("listing_transactions"):
        cols = {c['name'] for c in insp.get_columns('listing_transactions')}
        for col in ('coupon_discount', 'coupon_code', 'coupon_id'):
            if col in cols:
                op.drop_column('listing_transactions', col)

    if insp.has_table("coupon_redemptions"):
        op.drop_index('idx_coupon_redeem_owner', table_name='coupon_redemptions')
        op.drop_index('idx_coupon_redeem_coupon', table_name='coupon_redemptions')
        op.drop_table('coupon_redemptions')

    if insp.has_table("coupons"):
        op.drop_table('coupons')
