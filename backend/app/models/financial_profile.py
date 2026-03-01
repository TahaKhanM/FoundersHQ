"""Financial profile per org: cash balance for runway/health (C0)."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.models.base import Base, gen_uuid


class FinancialProfile(Base):
    __tablename__ = "financial_profiles"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    cash_balance: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
