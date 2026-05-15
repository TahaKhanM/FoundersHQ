"""Tests for the requires_role FastAPI dependency."""
from __future__ import annotations

from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.deps import CurrentUser, requires_role
from app.models.org import Membership, Org
from app.models.user import User
from app.utils.hashing import hash_password
from app.utils.security import create_access_token


def _build_test_app(session_factory) -> FastAPI:
    from app.models.base import get_async_session
    app = FastAPI()

    async def _override():
        async with session_factory() as s:
            try:
                yield s
                await s.commit()
            except Exception:
                await s.rollback()
                raise

    app.dependency_overrides[get_async_session] = _override

    @app.get("/owner-only")
    async def owner_only(membership=requires_role("owner"), user: CurrentUser = None):  # type: ignore[assignment]
        return {"role": membership.role, "user_id": user.id}

    @app.get("/admin-or-owner")
    async def admin_or_owner(membership=requires_role("owner", "admin"), user: CurrentUser = None):  # type: ignore[assignment]
        return {"role": membership.role}

    return app


@pytest_asyncio.fixture
async def make_user(async_session, session_factory):
    async def _make(role: str | None) -> tuple[User, str]:
        user = User(id=str(uuid4()), email=f"u-{uuid4().hex[:6]}@example.com", password_hash=hash_password("pw1234567"))
        async_session.add(user)
        if role is not None:
            org = Org(id=str(uuid4()), name="X")
            async_session.add(org)
            async_session.add(Membership(id=str(uuid4()), user_id=user.id, org_id=org.id, role=role))
        await async_session.commit()
        token = create_access_token(user.id)
        return user, token
    return _make


def _client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest.mark.asyncio
async def test_requires_role_owner_passes_for_owner_route(session_factory, make_user):
    _user, token = await make_user("owner")
    app = _build_test_app(session_factory)
    res = _client(app).get("/owner-only", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["role"] == "owner"


@pytest.mark.asyncio
async def test_requires_role_admin_passes_for_owner_or_admin_route(session_factory, make_user):
    _user, token = await make_user("admin")
    app = _build_test_app(session_factory)
    res = _client(app).get("/admin-or-owner", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_requires_role_member_forbidden(session_factory, make_user):
    _user, token = await make_user("member")
    app = _build_test_app(session_factory)
    res = _client(app).get("/owner-only", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "forbidden"


@pytest.mark.asyncio
async def test_requires_role_no_membership_forbidden(session_factory, make_user):
    _user, token = await make_user(None)
    app = _build_test_app(session_factory)
    res = _client(app).get("/owner-only", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_requires_role_unauthenticated(session_factory):
    app = _build_test_app(session_factory)
    res = _client(app).get("/owner-only")
    assert res.status_code == 401
