"""Add notifications and financial_profile tables.

Revision ID: 002
Revises: 001
Create Date: 2025-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(32), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("evidence_ids", postgresql.JSONB(), nullable=True),
        sa.Column("deep_link", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dedupe_key", sa.String(255), nullable=True),
        sa.Column("source", sa.String(64), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_org_id", "notifications", ["org_id"])
    op.create_index("ix_notifications_dedupe_key", "notifications", ["dedupe_key"])
    op.create_index("ix_notifications_org_dedupe", "notifications", ["org_id", "dedupe_key"])
    op.create_index("ix_notifications_read_at", "notifications", ["read_at"])

    op.create_table(
        "financial_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("cash_balance", sa.Numeric(18, 4), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_financial_profiles_org_id", "financial_profiles", ["org_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_financial_profiles_org_id", table_name="financial_profiles")
    op.drop_table("financial_profiles")
    op.drop_index("ix_notifications_read_at", table_name="notifications")
    op.drop_index("ix_notifications_org_dedupe", table_name="notifications")
    op.drop_index("ix_notifications_dedupe_key", table_name="notifications")
    op.drop_index("ix_notifications_org_id", table_name="notifications")
    op.drop_table("notifications")
