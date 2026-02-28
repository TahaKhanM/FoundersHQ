"""Customers, invoices, invoice events, predictions, risk scores."""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import String, Date, DateTime, ForeignKey, Numeric, Text, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB

from app.models.base import Base, gen_uuid


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    name_raw: Mapped[str] = mapped_column(String(512), nullable=False)
    name_canonical: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    invoices: Mapped[list["Invoice"]] = relationship("Invoice", back_populates="customer")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_number: Mapped[str] = mapped_column(String(128), nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    paid_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)  # open/overdue/paid/cancelled
    po_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_invoice_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    needs_review: Mapped[bool] = mapped_column(default=False, nullable=False)
    extraction_report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="invoices")
    events: Mapped[list["InvoiceEvent"]] = relationship("InvoiceEvent", back_populates="invoice")
    predictions: Mapped[list["InvoicePrediction"]] = relationship("InvoicePrediction", back_populates="invoice")
    risk_scores: Mapped[list["InvoiceRiskScore"]] = relationship("InvoiceRiskScore", back_populates="invoice")

    __table_args__ = (Index("ix_invoices_org_due", "org_id", "due_date"), Index("ix_invoices_org_status", "org_id", "status"),)


class InvoiceEvent(Base):
    __tablename__ = "invoice_events"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)  # email/call/other
    touch_type: Mapped[str] = mapped_column(String(32), nullable=False)  # reminder/escalation/dispute
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="events")


class InvoicePrediction(Base):
    __tablename__ = "invoice_predictions"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    expected_pay_date_base: Mapped[date] = mapped_column(Date, nullable=False)
    expected_pay_date_pess: Mapped[date] = mapped_column(Date, nullable=False)
    confidence_tier: Mapped[str] = mapped_column(String(32), nullable=False)  # high/medium/low
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="predictions")


class InvoiceRiskScore(Base):
    __tablename__ = "invoice_risk_scores"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    risk_score: Mapped[float] = mapped_column(nullable=False)
    priority_score: Mapped[float] = mapped_column(nullable=False)
    reasons: Mapped[list] = mapped_column(JSONB, nullable=False)  # list of strings
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="risk_scores")


class InvoiceParsingJob(Base):
    """Stores parsed invoice payload from integration; review workflow."""
    __tablename__ = "invoice_parsing_jobs"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)  # pending_review / confirmed / rejected
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)  # extracted fields + confidences
    extraction_report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    invoice_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
