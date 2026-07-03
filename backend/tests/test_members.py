"""Member list / patch role / remove (admin-only, last-owner invariant)."""
from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.org import Membership
from app.models.user import User
from app.services.events import drain_events
from app.utils.hashing import hash_password
from app.utils.security import create_access_token


def _register(client, email: str, password: str = "pw1234567"):
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


async def _fetch_org_id(client, token: str) -> str:
    r = client.get("/org", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


async def _attach_member(async_session, *, org_id: str, role: str) -> tuple[User, Membership, str]:
    u = User(id=str(uuid4()), email=f"m-{uuid4().hex[:6]}@ex.com", password_hash=hash_password("pw1234567"))
    m = Membership(id=str(uuid4()), user_id=u.id, org_id=org_id, role=role)
    async_session.add_all([u, m])
    await async_session.commit()
    return u, m, create_access_token(u.id)


@pytest.mark.asyncio
async def test_list_members_returns_all(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_token = owner["access_token"]
    org_id = await _fetch_org_id(client, owner_token)
    _, _, _ = await _attach_member(async_session, org_id=org_id, role="member")

    r = client.get("/org/members", headers={"Authorization": f"Bearer {owner_token}"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) == 2
    roles = sorted(m["role"] for m in body)
    assert roles == ["member", "owner"]


@pytest.mark.asyncio
async def test_patch_member_role_admin_only(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_token = owner["access_token"]
    org_id = await _fetch_org_id(client, owner_token)
    _, member, member_token = await _attach_member(async_session, org_id=org_id, role="member")

    # member cannot patch
    r = client.patch(
        f"/org/members/{member.id}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"role": "admin"},
    )
    assert r.status_code == 403

    # owner can
    drain_events()
    r2 = client.patch(
        f"/org/members/{member.id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"role": "admin"},
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["role"] == "admin"

    # audit + event
    rows = (await async_session.execute(
        select(AuditLog).where(AuditLog.action == "membership.role_changed")
    )).scalars().all()
    assert len(rows) == 1
    assert "membership.role_changed" in [t for (_, t, _) in drain_events()]


@pytest.mark.asyncio
async def test_cannot_demote_last_owner(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_token = owner["access_token"]
    org_id = await _fetch_org_id(client, owner_token)
    # find owner's membership
    owner_membership = (await async_session.execute(
        select(Membership).where(Membership.org_id == org_id).where(Membership.role == "owner")
    )).scalar_one()

    r = client.patch(
        f"/org/members/{owner_membership.id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"role": "member"},
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "last_owner"


@pytest.mark.asyncio
async def test_can_demote_owner_if_another_owner_exists(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_token = owner["access_token"]
    org_id = await _fetch_org_id(client, owner_token)
    _, second_owner, _ = await _attach_member(async_session, org_id=org_id, role="owner")
    original_owner_membership = (await async_session.execute(
        select(Membership).where(Membership.org_id == org_id).where(Membership.role == "owner").where(Membership.id != second_owner.id)
    )).scalar_one()

    r = client.patch(
        f"/org/members/{original_owner_membership.id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"role": "admin"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_remove_member_admin_only(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_token = owner["access_token"]
    org_id = await _fetch_org_id(client, owner_token)
    _, member, member_token = await _attach_member(async_session, org_id=org_id, role="member")

    # member cannot remove
    r = client.delete(
        f"/org/members/{member.id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert r.status_code == 403

    drain_events()
    r2 = client.delete(
        f"/org/members/{member.id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert r2.status_code == 204
    rows = (await async_session.execute(
        select(AuditLog).where(AuditLog.action == "membership.removed")
    )).scalars().all()
    assert len(rows) == 1
    assert "membership.removed" in [t for (_, t, _) in drain_events()]


@pytest.mark.asyncio
async def test_cannot_remove_last_owner(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_token = owner["access_token"]
    org_id = await _fetch_org_id(client, owner_token)
    owner_membership = (await async_session.execute(
        select(Membership).where(Membership.org_id == org_id).where(Membership.role == "owner")
    )).scalar_one()

    r = client.delete(
        f"/org/members/{owner_membership.id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "last_owner"


@pytest.mark.asyncio
async def test_patch_nonexistent_member_returns_404(client):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_token = owner["access_token"]
    r = client.patch(
        f"/org/members/{uuid4()}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"role": "admin"},
    )
    assert r.status_code == 404
