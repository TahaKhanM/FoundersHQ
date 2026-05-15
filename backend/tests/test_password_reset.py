"""Password reset: model + API round-trip."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.auth.tokens import generate_token, hash_token
from app.services.events import drain_events


@pytest.mark.asyncio
async def test_password_reset_model_persists_and_hashes(async_session):
    user = User(id=str(uuid4()), email=f"r-{uuid4().hex[:6]}@ex.com", password_hash="x")
    async_session.add(user)
    await async_session.commit()

    raw, token_hash = generate_token()
    prt = PasswordResetToken(
        id=str(uuid4()),
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    async_session.add(prt)
    await async_session.commit()

    got = (await async_session.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(raw))
    )).scalar_one()
    assert got.user_id == user.id
    assert got.consumed_at is None
    assert got.token_hash != raw
    assert len(got.token_hash) == 64


# ----- API round-trip -----

def _register(client, email: str, password: str = "pw1234567"):
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_forgot_password_returns_ok_for_unknown_user_and_skips_audit(client, async_session):
    drain_events()
    r = client.post("/auth/forgot-password", json={"email": f"nobody-{uuid4().hex[:6]}@ex.com"})
    assert r.status_code == 200
    assert r.json()["ok"] is True
    # no token leaked
    assert "dev_token" not in r.json() or r.json().get("dev_token") is None
    # no audit row for nonexistent user
    rows = (await async_session.execute(
        select(AuditLog).where(AuditLog.action == "auth.password_reset_requested")
    )).scalars().all()
    assert len(rows) == 0


@pytest.mark.asyncio
async def test_forgot_password_returns_dev_token_for_known_user(client, async_session):
    email = f"u-{uuid4().hex[:6]}@ex.com"
    _register(client, email=email)
    r = client.post("/auth/forgot-password", json={"email": email})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert isinstance(body["dev_token"], str) and len(body["dev_token"]) > 20

    # audit row exists
    rows = (await async_session.execute(
        select(AuditLog).where(AuditLog.action == "auth.password_reset_requested")
    )).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_reset_password_round_trip_consumes_token(client, async_session):
    email = f"u-{uuid4().hex[:6]}@ex.com"
    _register(client, email=email, password="oldpw1234")
    drain_events()

    body = client.post("/auth/forgot-password", json={"email": email}).json()
    raw = body["dev_token"]

    r2 = client.post("/auth/reset-password", json={"token": raw, "new_password": "newpw5678"})
    assert r2.status_code == 200, r2.text
    assert r2.json()["ok"] is True

    # second use rejected
    r3 = client.post("/auth/reset-password", json={"token": raw, "new_password": "anotherpw"})
    assert r3.status_code == 400
    assert r3.json()["detail"]["code"] == "invalid_token"

    # password actually updated: old fails, new works
    r4 = client.post("/auth/login", json={"email": email, "password": "oldpw1234"})
    assert r4.status_code == 401
    r5 = client.post("/auth/login", json={"email": email, "password": "newpw5678"})
    assert r5.status_code == 200, r5.text

    # audit + event
    consumed = (await async_session.execute(
        select(AuditLog).where(AuditLog.action == "auth.password_reset_consumed")
    )).scalars().all()
    assert len(consumed) == 1

    types = [t for (_, t, _) in drain_events()]
    assert "auth.password_reset_consumed" in types


@pytest.mark.asyncio
async def test_reset_password_rejects_unknown_token(client):
    r = client.post("/auth/reset-password", json={"token": "bogus-token", "new_password": "newpw5678"})
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "invalid_token"

