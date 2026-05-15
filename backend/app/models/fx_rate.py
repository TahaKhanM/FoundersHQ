"""FX rate snapshots — daily rows used to convert source currencies into the
org's base currency at write time.

Multi-currency design (phase 2.C):

- Rows are deterministic snapshots fed from an external feed (e.g. ECB);
  the application never invents rates. Tests feed rows directly.
- ``rate`` expresses how many units of ``target_currency`` one unit of
  ``source_currency`` buys on ``date``. So ``EUR -> USD @ 1.10`` means
  EUR 100 converts to USD 110.
- A composite UNIQUE constraint on ``(date, source_currency, target_currency)``
  prevents duplicate rate rows for the same day/pair.
- Not org-scoped: rates are universal facts, shared across tenants.
"""
from __future__ import annotations

from datetime import date as date_cls
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Index, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, gen_uuid


class FxRate(Base):
    __tablename__ = "fx_rates"

    id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid
    )
    date: Mapped[date_cls] = mapped_column(Date, nullable=False)
    source_currency: Mapped[str] = mapped_column(String(8), nullable=False)
    target_currency: Mapped[str] = mapped_column(String(8), nullable=False)
    # Decimal(18, 10) — enough headroom for both exotic-pair micro-rates
    # (JPY/USD ~0.0067) and inverse macro-pairs (KRW/JPY > 10).
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint(
            "date",
            "source_currency",
            "target_currency",
            name="uq_fx_rates_date_pair",
        ),
        Index("ix_fx_rates_pair_date", "source_currency", "target_currency", "date"),
    )
