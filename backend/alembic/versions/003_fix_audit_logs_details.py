"""Rename audit_logs.metadata to details (reserved name conflict with SQLAlchemy).

Revision ID: 003
Revises: 002
Create Date: 2025-03-01

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "audit_logs",
        "metadata",
        new_column_name="details",
        existing_type=postgresql.JSONB(),
    )


def downgrade() -> None:
    op.alter_column(
        "audit_logs",
        "details",
        new_column_name="metadata",
        existing_type=postgresql.JSONB(),
    )
