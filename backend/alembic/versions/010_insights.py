"""Phase 2.F: insight stream.

Revision ID: 010
Revises: 009
Create Date: 2026-05-16

Adds:

- ``insights`` table — proactive findings produced by deterministic
  generators. Columns mirror the ``Insight`` ORM model: ``org_id``,
  ``type``, ``severity``, ``title``, ``body``, ``evidence_ids`` (JSONB),
  ``evidence_hash``, ``status``, ``deep_link``, ``created_at``,
  ``dismissed_at``.

Indexes:

- ``ix_insights_org_status_created`` covers the inbox query
  (``WHERE org_id = ? AND status = ? ORDER BY created_at DESC``).
- ``ix_insights_org_type_hash`` is the dedupe lookup
  (``WHERE org_id = ? AND type = ? AND evidence_hash = ?``).
- Plus single-column indexes on ``org_id`` and ``evidence_hash``
  (auto-named to match the SQLAlchemy convention) for completeness.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "010"
down_revision: Union[str, Sequence[str], None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "insights",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("evidence_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("evidence_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.Column("deep_link", sa.String(length=512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    # Single-column index on org_id for org-wide lookups outside the inbox.
    op.create_index("ix_insights_org_id", "insights", ["org_id"])
    op.create_index(
        "ix_insights_evidence_hash", "insights", ["evidence_hash"]
    )
    op.create_index(
        "ix_insights_org_status_created",
        "insights",
        ["org_id", "status", "created_at"],
    )
    op.create_index(
        "ix_insights_org_type_hash",
        "insights",
        ["org_id", "type", "evidence_hash"],
    )


def downgrade() -> None:
    op.drop_index("ix_insights_org_type_hash", table_name="insights")
    op.drop_index("ix_insights_org_status_created", table_name="insights")
    op.drop_index("ix_insights_evidence_hash", table_name="insights")
    op.drop_index("ix_insights_org_id", table_name="insights")
    op.drop_table("insights")
