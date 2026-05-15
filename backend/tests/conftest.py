"""Shared pytest fixtures."""
from __future__ import annotations

import contextlib
import uuid as _uuid_pkg
from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest
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


# Production code occasionally compares against a real ``uuid.UUID`` instance
# (e.g. ``where(User.id == UUID(user_id))`` in deps.py); the stock SQLite
# bind processor for PG_UUID(as_uuid=False) only knows strings. Coerce UUID
# objects to their canonical string form before binding.
_original_bind_processor = PG_UUID.bind_processor


def _uuid_bind_processor_patch(self, dialect):  # noqa: ANN001
    inner = _original_bind_processor(self, dialect)
    if inner is None:
        def _bind(value):
            if isinstance(value, _uuid_pkg.UUID):
                return str(value)
            return value
        return _bind

    def _bind(value):
        if isinstance(value, _uuid_pkg.UUID):
            value = str(value)
        return inner(value)
    return _bind


PG_UUID.bind_processor = _uuid_bind_processor_patch  # type: ignore[assignment]


def _import_all_models() -> None:
    """Populate Base.metadata before create_all."""
    from app.models import (  # noqa: F401
        audit,
        commitment,
        financial_profile,
        funding,
        invitation,
        invoice,
        llm,
        notification,
        notification_preference,
        org,
        password_reset,
        runway,
        transaction,
        user,
    )
    with contextlib.suppress(ImportError):
        from app.models import events_outbox  # noqa: F401


@pytest_asyncio.fixture
async def session_factory():
    """An async_sessionmaker bound to a fresh in-memory SQLite engine.

    Tests that need to construct their own short-lived sessions (e.g. when
    overriding a FastAPI dep with a session that auto-commits per request)
    use this factory; the simpler `async_session` fixture yields a single
    session for the whole test.
    """
    _import_all_models()
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        yield factory
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def async_session(session_factory) -> AsyncGenerator[AsyncSession, None]:
    """Async SQLAlchemy session against an in-memory SQLite DB.

    A fresh engine + schema per test keeps tests isolated.
    """
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


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


# ---------------------------------------------------------------------------
# `client` — FastAPI TestClient with the DB session swapped for the in-memory
# aiosqlite session above. 1.A's contract tests (and any future router test
# that wants to hit the live app) depend on this.
# ---------------------------------------------------------------------------


@pytest.fixture
def client(async_session: AsyncSession):
    """Sync TestClient wrapping the FastAPI app with overridden DB session."""
    from fastapi.testclient import TestClient

    from app.main import app
    from app.models.base import get_async_session

    async def _override_session() -> AsyncGenerator[AsyncSession, None]:
        yield async_session

    app.dependency_overrides[get_async_session] = _override_session
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_async_session, None)
