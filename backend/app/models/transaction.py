"""Bank accounts, transactions, categories, categorization rules."""
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import String, Date, DateTime, ForeignKey, Numeric, func, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB

from app.models.base import Base, gen_uuid


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, default="stub")
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TransactionCategory(Base):
    __tablename__ = "transaction_categories"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="category")
    rules: Mapped[list["CategorizationRule"]] = relationship("CategorizationRule", back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    bank_account_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    txn_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    merchant_raw: Mapped[str | None] = mapped_column(String(512), nullable=True)
    merchant_canonical: Mapped[str | None] = mapped_column(String(512), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)  # csv/api/questionnaire
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    dedupe_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    category_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("transaction_categories.id", ondelete="SET NULL"), nullable=True, index=True)

    category: Mapped["TransactionCategory | None"] = relationship("TransactionCategory", back_populates="transactions")

    __table_args__ = (Index("ix_transactions_org_txn_date", "org_id", "txn_date"),)


class CategorizationRule(Base):
    __tablename__ = "categorization_rules"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True)
    pattern: Mapped[str] = mapped_column(String(512), nullable=False)
    match_type: Mapped[str] = mapped_column(String(32), nullable=False)  # contains/regex
    category_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("transaction_categories.id", ondelete="CASCADE"), nullable=False)
    enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    category: Mapped["TransactionCategory"] = relationship("TransactionCategory", back_populates="rules")
