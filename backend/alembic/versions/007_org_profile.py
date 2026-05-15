"""Phase 1.B: add org-profile + onboarding-state columns to `orgs`.

Revision ID: 007
Revises: 006
Create Date: 2026-05-15

Adds six columns:
- base_currency (default 'USD'),
- fiscal_year_start_month (default 1),
- industry (nullable),
- stage (nullable),
- persona (nullable),
- onboarding_completed_at (nullable).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orgs",
        sa.Column(
            "base_currency",
            sa.String(length=8),
            nullable=False,
            server_default=sa.text("'USD'"),
        ),
    )
    op.add_column(
        "orgs",
        sa.Column(
            "fiscal_year_start_month",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )
    op.add_column("orgs", sa.Column("industry", sa.String(length=64), nullable=True))
    op.add_column("orgs", sa.Column("stage", sa.String(length=32), nullable=True))
    op.add_column("orgs", sa.Column("persona", sa.String(length=32), nullable=True))
    op.add_column(
        "orgs",
        sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("orgs", "onboarding_completed_at")
    op.drop_column("orgs", "persona")
    op.drop_column("orgs", "stage")
    op.drop_column("orgs", "industry")
    op.drop_column("orgs", "fiscal_year_start_month")
    op.drop_column("orgs", "base_currency")
