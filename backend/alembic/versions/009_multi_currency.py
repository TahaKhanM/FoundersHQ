"""Phase 2.C: multi-currency.

Revision ID: 009
Revises: 005, 007, 008
Create Date: 2026-05-15

Adds:
- ``fx_rates`` table — daily snapshots of source->target rates. Universal
  (not org-scoped). UNIQUE on ``(date, source_currency, target_currency)``.
- ``transactions.fx_rate_used`` (nullable Decimal) — rate captured at write
  time so historical conversions remain reproducible.
- ``invoices.fx_rate_used`` (nullable Decimal) — same.

Also merges three pre-existing alembic heads (``005``, ``007``, ``008``)
that diverged from ``003`` during phase 1. ``alembic upgrade head`` is
unambiguous once this revision lands.

Postgres-only (the codebase targets Postgres for prod); the test suite
exercises the model layer against SQLite via ``Base.metadata.create_all``.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009"
# Three-way merge: this revision is the new single head.
down_revision: Union[str, Sequence[str], None] = ("005", "007", "008")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- fx_rates table ---
    op.create_table(
        "fx_rates",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("source_currency", sa.String(length=8), nullable=False),
        sa.Column("target_currency", sa.String(length=8), nullable=False),
        sa.Column("rate", sa.Numeric(precision=18, scale=10), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "date",
            "source_currency",
            "target_currency",
            name="uq_fx_rates_date_pair",
        ),
    )
    op.create_index(
        "ix_fx_rates_pair_date",
        "fx_rates",
        ["source_currency", "target_currency", "date"],
    )

    # --- fx_rate_used on transactions + invoices ---
    op.add_column(
        "transactions",
        sa.Column(
            "fx_rate_used",
            sa.Numeric(precision=18, scale=10),
            nullable=True,
        ),
    )
    op.add_column(
        "invoices",
        sa.Column(
            "fx_rate_used",
            sa.Numeric(precision=18, scale=10),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("invoices", "fx_rate_used")
    op.drop_column("transactions", "fx_rate_used")
    op.drop_index("ix_fx_rates_pair_date", table_name="fx_rates")
    op.drop_table("fx_rates")
