"""add property description trgm index

Revision ID: fb5c6d7e8f90
Revises: ea4b5c6d7e8f
Create Date: 2026-10-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fb5c6d7e8f90'
down_revision: Union[str, Sequence[str], None] = 'ea4b5c6d7e8f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _pg_trgm_available(conn) -> bool:
    try:
        conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        return True
    except Exception:
        return False


def upgrade() -> None:
    """Add a GIN trigram index so keyword search can use ILIKE on description.

    The public search ORs title/location/description ILIKE clauses; without an
    index on description the whole OR falls back to a sequential scan.

    Skipped when the pg_trgm contrib module is unavailable (shared hosting).
    """
    conn = op.get_bind()
    if not _pg_trgm_available(conn):
        return
    op.create_index(
        'idx_property_description_trgm',
        'properties',
        ['description'],
        unique=False,
        postgresql_using='gin',
        postgresql_ops={'description': 'gin_trgm_ops'},
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_property_description_trgm")
