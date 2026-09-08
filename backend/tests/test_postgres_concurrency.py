"""Database serialization properties that SQLite cannot establish."""
import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.api.routers.org import patch_member_role
from app.api.schemas import MembershipPatch
from app.config import get_settings
from app.models.org import Membership, Org
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.auth.tokens import consume_reset_token, generate_token

pytestmark = pytest.mark.integration


async def test_postgres_serializes_last_owner_changes_and_token_consumption():
    engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    org_id = str(uuid4())
    user_ids = [str(uuid4()), str(uuid4())]
    membership_ids = [str(uuid4()), str(uuid4())]
    raw, hashed = generate_token()
    async with sessions() as session:
        session.add(Org(id=org_id, name="concurrency-test"))
        session.add_all(User(id=u, email=f"race-{u}@example.com", password_hash="unused")
                        for u in user_ids)
        await session.flush()
        session.add_all(Membership(id=m, user_id=u, org_id=org_id, role="owner")
                        for m, u in zip(membership_ids, user_ids, strict=True))
        session.add(PasswordResetToken(user_id=user_ids[0], token_hash=hashed,
                                       expires_at=datetime.now(UTC) + timedelta(minutes=5)))
        await session.commit()
    try:
        ready = asyncio.Barrier(2)

        async def demote(index):
            async with sessions() as session:
                org = await session.get(Org, org_id)
                user = await session.get(User, user_ids[index])
                membership = await session.get(Membership, membership_ids[index])
                await ready.wait()
                try:
                    await patch_member_role(membership.id, MembershipPatch(role="member"),
                                            org, user, session, membership)
                    await session.commit()
                    return 200
                except HTTPException as exc:
                    await session.rollback()
                    return exc.status_code

        assert sorted(await asyncio.wait_for(asyncio.gather(demote(0), demote(1)), 10)) == [200, 400]
        async with sessions() as session:
            owners = (await session.scalars(select(Membership).where(
                Membership.org_id == org_id, Membership.role == "owner",
            ))).all()
            assert len(owners) == 1

        ready = asyncio.Barrier(2)

        async def consume():
            async with sessions() as session:
                await ready.wait()
                token = await consume_reset_token(session, raw)
                await session.commit()
                return token is not None

        assert sorted(await asyncio.wait_for(asyncio.gather(consume(), consume()), 10)) == [False, True]
    finally:
        async with sessions() as session:
            await session.execute(delete(Org).where(Org.id == org_id))
            await session.execute(delete(User).where(User.id.in_(user_ids)))
            await session.commit()
        await engine.dispose()
