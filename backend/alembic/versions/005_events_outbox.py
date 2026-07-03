"""Add events_outbox table.

Revision ID: 005
Revises: 004
Create Date: 2026-05-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "events_outbox",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("seq", sa.String(64), nullable=False),
        sa.Column("type", sa.String(128), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_events_outbox_org_id", "events_outbox", ["org_id"])
    op.create_index("ix_events_outbox_org_seq", "events_outbox", ["org_id", "seq"])


def downgrade() -> None:
    op.drop_index("ix_events_outbox_org_seq", table_name="events_outbox")
    op.drop_index("ix_events_outbox_org_id", table_name="events_outbox")
    op.drop_table("events_outbox")
