"""Invitations: model + tokens + API round-trip."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.invitation import Invitation
from app.models.org import Membership, Org
from app.models.user import User
from app.services.auth.tokens import (
    consume_invitation_token,
    generate_token,
    hash_token,
    verify_invitation_token,
)
from app.services.events import drain_events
from app.utils.hashing import hash_password


@pytest.mark.asyncio
async def test_invitation_model_persists_and_indexes_org_id(async_session):
    org = Org(id=str(uuid4()), name="X")
    inviter = User(id=str(uuid4()), email=f"i-{uuid4().hex[:6]}@ex.com", password_hash="x")
    async_session.add_all([org, inviter])
    await async_session.commit()

    raw, token_hash = generate_token()
    inv = Invitation(
        id=str(uuid4()),
        org_id=org.id,
        email="invitee@example.com",
        role="admin",
        token_hash=token_hash,
        created_by_user_id=inviter.id,
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    async_session.add(inv)
    await async_session.commit()

    found = (await async_session.execute(select(Invitation).where(Invitation.token_hash == hash_token(raw)))).scalar_one()
    assert found.org_id == org.id
    assert found.email == "invitee@example.com"
    assert found.role == "admin"
    assert found.accepted_at is None
    assert found.revoked_at is None
    # Raw token must NOT be the stored value.
    assert raw != found.token_hash
    assert len(found.token_hash) == 64  # sha256 hex


@pytest.mark.asyncio
async def test_verify_invitation_token_happy(async_session):
    org = Org(id=str(uuid4()), name="X")
    inviter = User(id=str(uuid4()), email=f"i-{uuid4().hex[:6]}@ex.com", password_hash="x")
    async_session.add_all([org, inviter])
    await async_session.commit()

    raw, token_hash = generate_token()
    inv = Invitation(
        id=str(uuid4()), org_id=org.id, email="x@ex.com", role="admin",
        token_hash=token_hash, created_by_user_id=inviter.id,
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    async_session.add(inv)
    await async_session.commit()

    got = await verify_invitation_token(async_session, raw)
    assert got is not None
    assert got.email == "x@ex.com"


@pytest.mark.asyncio
async def test_verify_invitation_token_expired_returns_none(async_session):
    org = Org(id=str(uuid4()), name="X")
    inviter = User(id=str(uuid4()), email=f"i-{uuid4().hex[:6]}@ex.com", password_hash="x")
    async_session.add_all([org, inviter])
    await async_session.commit()

    raw, token_hash = generate_token()
    inv = Invitation(
        id=str(uuid4()), org_id=org.id, email="x@ex.com", role="admin",
        token_hash=token_hash, created_by_user_id=inviter.id,
        expires_at=datetime.now(UTC) - timedelta(seconds=1),
    )
    async_session.add(inv)
    await async_session.commit()

    assert await verify_invitation_token(async_session, raw) is None


@pytest.mark.asyncio
async def test_consume_invitation_token_marks_accepted_and_blocks_reuse(async_session):
    org = Org(id=str(uuid4()), name="X")
    inviter = User(id=str(uuid4()), email=f"i-{uuid4().hex[:6]}@ex.com", password_hash="x")
    async_session.add_all([org, inviter])
    await async_session.commit()

    raw, token_hash = generate_token()
    inv = Invitation(
        id=str(uuid4()), org_id=org.id, email="x@ex.com", role="admin",
        token_hash=token_hash, created_by_user_id=inviter.id,
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    async_session.add(inv)
    await async_session.commit()

    consumed = await consume_invitation_token(async_session, raw)
    assert consumed is not None
    assert consumed.accepted_at is not None

    # second attempt must fail
    assert await consume_invitation_token(async_session, raw) is None


@pytest.mark.asyncio
async def test_verify_invitation_token_unknown_returns_none(async_session):
    assert await verify_invitation_token(async_session, "nope-not-a-real-token") is None


# ---------- API: POST /org/invitations + /auth/accept-invite ----------
def _register(client, email: str = "owner@example.com", password: str = "pw1234567"):
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_create_invitation_admin_route_gated_to_admins(client, async_session):
    # owner registers
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_token = owner["access_token"]
    org_id = await _fetch_org_id(client, owner_token)

    # Owner can post an invitation.
    r = client.post(
        "/org/invitations",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": "newcomer@example.com", "role": "admin"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == "newcomer@example.com"
    assert data["role"] == "admin"
    # dev_token is returned in non-prod
    assert isinstance(data.get("dev_token"), str)
    assert len(data["dev_token"]) > 20

    # Create a true member-role user attached to *this* org.
    member_user = User(id=str(uuid4()), email=f"m-{uuid4().hex[:6]}@ex.com", password_hash=hash_password("pw1234567"))
    member_membership = Membership(id=str(uuid4()), user_id=member_user.id, org_id=org_id, role="member")
    async_session.add_all([member_user, member_membership])
    await async_session.commit()
    from app.utils.security import create_access_token
    member_token = create_access_token(member_user.id)

    r2 = client.post(
        "/org/invitations",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"email": "x@ex.com", "role": "admin"},
    )
    assert r2.status_code == 403


async def _fetch_org_id(client, token: str) -> str:
    r = client.get("/org", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.mark.asyncio
async def test_accept_invite_creates_user_and_membership(client):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_token = owner["access_token"]
    await _fetch_org_id(client, owner_token)  # warm the org row

    invite_email = f"new-{uuid4().hex[:6]}@ex.com"
    r = client.post(
        "/org/invitations",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": invite_email, "role": "admin"},
    )
    assert r.status_code == 200, r.text
    dev_token = r.json()["dev_token"]

    # Accept
    r2 = client.post(
        "/auth/accept-invite",
        json={"token": dev_token, "email": invite_email, "password": "newpw1234"},
    )
    assert r2.status_code == 200, r2.text
    sess = r2.json()
    assert sess["user"]["email"] == invite_email
    assert sess["access_token"]

    # Re-accept rejected.
    r3 = client.post(
        "/auth/accept-invite",
        json={"token": dev_token, "email": invite_email, "password": "newpw1234"},
    )
    assert r3.status_code == 400
    assert r3.json()["detail"]["code"] == "invalid_token"


@pytest.mark.asyncio
async def test_revoke_invitation_blocks_acceptance(client):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_token = owner["access_token"]

    inv_email = f"x-{uuid4().hex[:6]}@ex.com"
    r = client.post(
        "/org/invitations",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": inv_email, "role": "admin"},
    )
    invite_id = r.json()["id"]
    dev_token = r.json()["dev_token"]

    # revoke
    rd = client.delete(
        f"/org/invitations/{invite_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert rd.status_code == 204

    # cannot accept
    r2 = client.post(
        "/auth/accept-invite",
        json={"token": dev_token, "email": inv_email, "password": "newpw1234"},
    )
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_create_invitation_writes_audit_and_event(client, async_session):
    drain_events()  # clear from any prior test
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_token = owner["access_token"]
    org_id = await _fetch_org_id(client, owner_token)

    r = client.post(
        "/org/invitations",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": "x@ex.com", "role": "admin"},
    )
    assert r.status_code == 200, r.text

    # audit row
    from app.models.audit import AuditLog
    rows = (await async_session.execute(
        select(AuditLog).where(AuditLog.action == "invitation.created").where(AuditLog.org_id == org_id)
    )).scalars().all()
    assert len(rows) == 1

    types = [t for (_, t, _) in drain_events()]
    assert "invitation.created" in types

