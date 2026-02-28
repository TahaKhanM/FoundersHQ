"""Funding providers, opportunities, versions, scrape jobs, user saved."""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import String, Integer, Float, Date, DateTime, ForeignKey, Numeric, Text, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB

from app.models.base import Base, gen_uuid


class FundingProvider(Base):
    __tablename__ = "funding_providers"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    website: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    opportunities: Mapped[list["FundingOpportunity"]] = relationship("FundingOpportunity", back_populates="provider")


class FundingOpportunity(Base):
    __tablename__ = "funding_opportunities"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    provider_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("funding_providers.id", ondelete="SET NULL"), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False)  # grant/loan/accelerator/rbf/other
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    geography: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sector_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    stage_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    amount_min: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    amount_max: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    cycle_time_days_est: Mapped[int | None] = mapped_column(Integer, nullable=True)
    eligibility_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    requirements_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    application_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    parse_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    provider: Mapped["FundingProvider | None"] = relationship("FundingProvider", back_populates="opportunities")
    versions: Mapped[list["FundingVersion"]] = relationship("FundingVersion", back_populates="opportunity")


class FundingVersion(Base):
    __tablename__ = "funding_versions"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    opportunity_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("funding_opportunities.id", ondelete="CASCADE"), nullable=False, index=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    diff_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_snapshot_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)

    opportunity: Mapped["FundingOpportunity"] = relationship("FundingOpportunity", back_populates="versions")


class ScrapeJob(Base):
    __tablename__ = "scrape_jobs"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    source_name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class UserSavedOpportunity(Base):
    __tablename__ = "user_saved_opportunities"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("funding_opportunities.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)  # planned/applied/declined
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_user_saved_org_opp", "org_id", "opportunity_id", unique=True),)
