"""Insight model: proactive, deterministic findings surfaced into the inbox.

Insights are pure-function findings (cash drop, late invoice, vendor spike,
commitment renewal, runway change) produced by deterministic generators in
``app.services.insights``. They share the inbox UX with notifications but
carry richer evidence — each insight references the transaction / invoice
UUIDs that drive it via ``evidence_ids`` so the Evidence chip can resolve
back to the underlying rows.

Deduplication is by ``(org_id, type, evidence_hash)`` where ``evidence_hash``
is ``sha256(",".join(sorted(evidence_ids)))``. The orchestrator computes and
persists this hash so re-runs are idempotent.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, gen_uuid


class Insight(Base):
    __tablename__ = "insights"

    id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid
    )
    org_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=False),
        ForeignKey("orgs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Generator key: cash_drop | late_invoice | vendor_spike |
    # commitment_renewal | runway_change. Kept as a string for forward
    # compatibility — new generators only need a new key, not a new enum.
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Dedup hash over sorted evidence ids; orchestrator computes + persists.
    evidence_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # ``active`` until the user dismisses it; ``dismissed`` once acted on.
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="active"
    )
    deep_link: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    dismissed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        # The inbox lists active insights for an org sorted newest-first;
        # this composite covers the hot path without an extra ORDER BY scan.
        Index(
            "ix_insights_org_status_created",
            "org_id",
            "status",
            "created_at",
        ),
        # Lookup-by-dedupe-key used inside the orchestrator.
        Index(
            "ix_insights_org_type_hash",
            "org_id",
            "type",
            "evidence_hash",
        ),
    )
