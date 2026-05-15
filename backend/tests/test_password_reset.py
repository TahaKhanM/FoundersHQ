"""Password reset: model + API round-trip."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.auth.tokens import generate_token, hash_token


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
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
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
