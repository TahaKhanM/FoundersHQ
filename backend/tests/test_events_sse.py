"""SSE /events + /events/replay tests.

The streaming test is marked ``@pytest.mark.integration`` and skipped when
``REDIS_URL`` is unset, because real Redis pub/sub isn't easily faked. The
replay test runs against SQLite and must pass in unit mode.
"""
from __future__ import annotations

import asyncio
import json
import os

import pytest
from httpx import ASGITransport, AsyncClient

from app.deps import get_async_session, get_current_org, get_current_user
from app.main import app
from app.services.events.publisher import publish_event


def _override_app(session, org, user) -> None:
    """Inject the SQLite session + pre-seeded org/user into the FastAPI graph.

    The production ``get_current_user`` runs ``UUID(user_id)`` against
    ``User.id`` and its bind-processor doesn't survive SQLite, so we bypass
    real JWT validation for these tests — the SSE endpoints aren't auth
    logic, they're scoping logic, and that's what these tests cover.
    """

    async def _session_override():
        yield session

    async def _user_override():
        return user

    async def _org_override():
        return org

    app.dependency_overrides[get_async_session] = _session_override
    app.dependency_overrides[get_current_user] = _user_override
    app.dependency_overrides[get_current_org] = _org_override


def _clear_overrides() -> None:
    for dep in (get_async_session, get_current_user, get_current_org):
        app.dependency_overrides.pop(dep, None)


@pytest.mark.asyncio
async def test_replay_since_returns_past_events(
    async_session, seeded_org, seeded_user, fake_redis
) -> None:
    """The replay endpoint returns events strictly after the cursor in seq order."""
    seq1 = await publish_event(
        async_session,
        redis=fake_redis,
        org_id=seeded_org.id,
        type="a",
        payload={"n": 1},
    )
    seq2 = await publish_event(
        async_session,
        redis=fake_redis,
        org_id=seeded_org.id,
        type="b",
        payload={"n": 2},
    )
    await async_session.commit()
    assert seq2 > seq1

    _override_app(async_session, seeded_org, seeded_user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            r = await client.get(f"/events/replay?since={seq1}")
            assert r.status_code == 200, r.text
            events = r.json()
            assert len(events) == 1
            assert events[0]["seq"] == seq2
            assert events[0]["type"] == "b"
            assert events[0]["payload"] == {"n": 2}
    finally:
        _clear_overrides()


@pytest.mark.asyncio
async def test_replay_without_since_returns_all_events(
    async_session, seeded_org, seeded_user, fake_redis
) -> None:
    """Calling /events/replay with no cursor returns all events for the org."""
    await publish_event(
        async_session,
        redis=fake_redis,
        org_id=seeded_org.id,
        type="x",
        payload={},
    )
    await async_session.commit()

    _override_app(async_session, seeded_org, seeded_user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            r = await client.get("/events/replay")
            assert r.status_code == 200, r.text
            assert len(r.json()) == 1
    finally:
        _clear_overrides()


@pytest.mark.asyncio
async def test_replay_is_scoped_to_caller_org(
    async_session, seeded_org, seeded_user, fake_redis
) -> None:
    """Events for another org must not appear in the caller's replay."""
    # Event for the caller's org
    await publish_event(
        async_session,
        redis=fake_redis,
        org_id=seeded_org.id,
        type="mine",
        payload={},
    )
    # Event for a stranger org
    await publish_event(
        async_session,
        redis=fake_redis,
        org_id="00000000-0000-4000-8000-000000000000",
        type="not_mine",
        payload={},
    )
    await async_session.commit()

    _override_app(async_session, seeded_org, seeded_user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            r = await client.get("/events/replay")
            assert r.status_code == 200
            types = {e["type"] for e in r.json()}
            assert types == {"mine"}
    finally:
        _clear_overrides()


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.environ.get("REDIS_URL"),
    reason="real Redis pub/sub required; set REDIS_URL to enable",
)
async def test_sse_delivers_events_after_subscription(
    async_session, seeded_org, seeded_user
) -> None:
    import redis.asyncio as aioredis

    redis = aioredis.from_url(
        os.environ["REDIS_URL"], encoding="utf-8", decode_responses=False
    )

    _override_app(async_session, seeded_org, seeded_user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            async with client.stream("GET", "/events") as resp:
                assert resp.status_code == 200

                async def emit() -> None:
                    await asyncio.sleep(0.1)
                    await publish_event(
                        async_session,
                        redis=redis,
                        org_id=seeded_org.id,
                        type="ping",
                        payload={"ok": True},
                    )
                    await async_session.commit()

                asyncio.create_task(emit())

                got_event = False
                async for line in resp.aiter_lines():
                    if line.startswith("data:"):
                        msg = json.loads(line[5:].strip())
                        if msg.get("type") == "ping":
                            got_event = True
                            break
                assert got_event
    finally:
        _clear_overrides()
        await redis.aclose()
