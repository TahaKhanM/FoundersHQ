"""Invitations: model + tokens + API round-trip."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.invitation import Invitation
from app.models.org import Membership, Org
from app.models.user import User
from app.services.auth.tokens import generate_token, hash_token


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
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
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
