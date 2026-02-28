"""Commitments and commitment instances."""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import String, Date, DateTime, ForeignKey, Numeric, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.models.base import Base, gen_uuid


class Commitment(Base):
    __tablename__ = "commitments"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    merchant_canonical: Mapped[str] = mapped_column(String(512), nullable=False)
    frequency: Mapped[str] = mapped_column(String(32), nullable=False)  # weekly/monthly/annual
    typical_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    last_seen_date: Mapped[date] = mapped_column(Date, nullable=False)
    next_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    confidence: Mapped[float] = mapped_column(default=0.0, nullable=False)
    enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    instances: Mapped[list["CommitmentInstance"]] = relationship("CommitmentInstance", back_populates="commitment")


class CommitmentInstance(Base):
    __tablename__ = "commitment_instances"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    commitment_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("commitments.id", ondelete="CASCADE"), nullable=False, index=True)
    charge_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    txn_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    commitment: Mapped["Commitment"] = relationship("Commitment", back_populates="instances")

    __table_args__ = (Index("ix_commitment_instances_org_charge", "org_id", "charge_date"),)
