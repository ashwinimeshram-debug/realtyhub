"""show all 8 directions for every property type facing field

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-16 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FACING_ALL = [
    "East", "West", "North", "South",
    "North-East", "South-East", "North-West", "South-West",
]
FACING_SHORT = ["East", "West", "North", "South"]

_property_type_fields = sa.table(
    "property_type_fields",
    sa.column("property_type_value", sa.String),
    sa.column("field_key", sa.String),
    sa.column("options", sa.JSON),
)


def upgrade() -> None:
    """Give every property type's Facing field all 8 directions."""
    op.execute(
        _property_type_fields.update()
        .where(_property_type_fields.c.field_key == "facing")
        .values(options=FACING_ALL)
    )


def downgrade() -> None:
    """Restore the 4-direction list for non-plot types (plot keeps 8)."""
    op.execute(
        _property_type_fields.update()
        .where(
            sa.and_(
                _property_type_fields.c.field_key == "facing",
                _property_type_fields.c.property_type_value != "plot",
            )
        )
        .values(options=FACING_SHORT)
    )
