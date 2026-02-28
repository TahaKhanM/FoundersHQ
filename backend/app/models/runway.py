"""Runway forecasts, forecast rows, scenarios, milestones."""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import String, Integer, DateTime, ForeignKey, Numeric, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB

from app.models.base import Base, gen_uuid


class RunwayForecast(Base):
    __tablename__ = "runway_forecasts"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    horizon_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    cash_start: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    crash_week_base: Mapped[int | None] = mapped_column(Integer, nullable=True)
    crash_week_pess: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cash_weeks_base: Mapped[float | None] = mapped_column(nullable=True)
    cash_weeks_pess: Mapped[float | None] = mapped_column(nullable=True)
    inputs_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    scenario_params: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    rows: Mapped[list["ForecastRow"]] = relationship("ForecastRow", back_populates="forecast")


class ForecastRow(Base):
    __tablename__ = "forecast_rows"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    forecast_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("runway_forecasts.id", ondelete="CASCADE"), nullable=False, index=True)
    week_start: Mapped[date] = mapped_column(nullable=False)
    starting_cash: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    inflows: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    outflows: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    ending_cash: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    flags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    evidence_ids: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # list of txn/invoice ids

    forecast: Mapped["RunwayForecast"] = relationship("RunwayForecast", back_populates="rows")

    __table_args__ = (Index("ix_forecast_rows_forecast_week", "forecast_id", "week_start"),)


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    params: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)  # cash/runway/revenue
    target_value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    target_week_start: Mapped[date | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
