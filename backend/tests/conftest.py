"""Shared pytest fixtures."""
from __future__ import annotations

from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest_asyncio
from sqlalchemy import JSON, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.models.base import Base, gen_uuid
from app.models.org import Membership, Org
from app.models.user import User
from app.utils.security import create_access_token

pytest_plugins = ["pytest_asyncio"]


# Render Postgres-specific types as SQLite-compatible equivalents during tests.
# These compilers only fire when the active dialect is SQLite, so production
# behavior on Postgres is untouched.
@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):  # noqa: ANN001, ANN202
    return compiler.visit_JSON(JSON(), **kw)


@compiles(PG_UUID, "sqlite")
def _compile_uuid_sqlite(type_, compiler, **kw):  # noqa: ANN001, ANN202
    return compiler.visit_VARCHAR(String(36), **kw)


@pytest_asyncio.fixture
async def async_session() -> AsyncGenerator[AsyncSession, None]:
    """Async SQLAlchemy session against an in-memory SQLite DB.

    A fresh engine + schema per test keeps tests isolated.
    """
    # Import all models so Base.metadata is populated.
    from app.models import (  # noqa: F401
        audit,
        commitment,
        financial_profile,
        funding,
        invoice,
        llm,
        notification,
        org,
        runway,
        transaction,
        user,
    )
    # `events_outbox` is added in Task 5; import lazily so earlier tasks pass.
    try:
        from app.models import events_outbox  # noqa: F401
    except ImportError:
        pass

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
    await engine.dispose()


@pytest_asyncio.fixture
async def seeded_org(async_session: AsyncSession) -> Org:
    """Insert a single org and return it."""
    org = Org(id=gen_uuid(), name="Test Org")
    async_session.add(org)
    await async_session.flush()
    return org


@pytest_asyncio.fixture
async def seeded_user(async_session: AsyncSession, seeded_org: Org) -> User:
    """Insert a user + membership of `seeded_org` and return the user."""
    user = User(
        id=gen_uuid(),
        email=f"user-{uuid4().hex[:8]}@example.com",
        password_hash="not-a-real-hash",
    )
    async_session.add(user)
    await async_session.flush()
    async_session.add(
        Membership(id=gen_uuid(), user_id=user.id, org_id=seeded_org.id, role="owner")
    )
    await async_session.flush()
    return user


@pytest_asyncio.fixture
async def seeded_user_token(seeded_user: User) -> str:
    """Issue a JWT for the seeded user."""
    return create_access_token(seeded_user.id)


class FakeRedis:
    """In-process stand-in for redis.asyncio.Redis with just enough surface."""

    def __init__(self) -> None:
        self.published: dict[str, list[str]] = {}

    async def publish(self, channel: str, message: str) -> int:
        self.published.setdefault(channel, []).append(message)
        return 1


@pytest_asyncio.fixture
async def fake_redis() -> FakeRedis:
    return FakeRedis()
