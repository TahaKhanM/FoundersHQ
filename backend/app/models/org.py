"""Org and membership models."""
import enum
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, gen_uuid


class OrgRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    member = "member"


class Persona(str, enum.Enum):
    """Onboarding persona — drives copy and default dashboard layout.

    Stored as a plain string column on `orgs.persona` so the enum can evolve
    without an Alembic enum-type migration; the application layer validates.
    """
    founder_operator = "founder_operator"
    first_time_founder = "first_time_founder"
    second_time_founder = "second_time_founder"
    ops_finance_lead = "ops_finance_lead"


class Org(Base):
    __tablename__ = "orgs"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Phase 1.B: org profile + onboarding state. All optional except the two
    # with sensible defaults (`base_currency`, `fiscal_year_start_month`).
    base_currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD")
    fiscal_year_start_month: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    industry: Mapped[str | None] = mapped_column(String(64), nullable=True)
    stage: Mapped[str | None] = mapped_column(String(32), nullable=True)
    persona: Mapped[str | None] = mapped_column(String(32), nullable=True)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    memberships: Mapped[list["Membership"]] = relationship("Membership", back_populates="org")


class Membership(Base):
    __tablename__ = "memberships"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="member")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="memberships")
    org: Mapped["Org"] = relationship("Org", back_populates="memberships")

    __table_args__ = (Index("ix_memberships_user_org", "user_id", "org_id", unique=True),)
