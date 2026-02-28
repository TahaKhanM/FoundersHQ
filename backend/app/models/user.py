"""User model."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, relationship

from app.models.base import Base, gen_uuid
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    memberships: Mapped[list["Membership"]] = relationship("Membership", back_populates="user")
