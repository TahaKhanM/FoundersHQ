"""Notification model: persistent, org-scoped, dedupe by key."""
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Text, func, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB

from app.models.base import Base, gen_uuid


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    deep_link: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dedupe_key: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)
