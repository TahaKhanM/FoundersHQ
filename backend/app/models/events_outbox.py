"""Durable event outbox for SSE / webhook fanout.

Every state-changing event is written to this table before it's published
to Redis pub/sub. Clients reconnecting to ``/events`` can replay any events
they missed using ``GET /events/replay?since={seq}``.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, gen_uuid


class EventOutbox(Base):
    __tablename__ = "events_outbox"

    id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid
    )
    org_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=False), nullable=False, index=True
    )
    # Monotonic per process; used as the SSE event id and for replay cursor.
    seq: Mapped[str] = mapped_column(String(64), nullable=False)
    type: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_events_outbox_org_seq", "org_id", "seq"),
    )
