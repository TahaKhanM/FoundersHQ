"""SSE endpoint per org + replay-since endpoint for catch-up."""
from __future__ import annotations

from typing import Any, cast

import redis.asyncio as aioredis
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.config import get_settings
from app.deps import CurrentOrg, DbSession
from app.models.events_outbox import EventOutbox
from app.services.events.sse import RedisLike, sse_stream

router = APIRouter()


def _get_redis() -> aioredis.Redis:
    return aioredis.from_url(
        get_settings().redis_url, encoding="utf-8", decode_responses=False
    )


@router.get("")
async def events_stream(org: CurrentOrg) -> StreamingResponse:
    """Server-Sent Events stream for the caller's org."""
    redis = _get_redis()
    # The real Redis client has a wider pubsub() signature than our Protocol
    # advertises; cast tells mypy it satisfies the structural contract we
    # actually use (subscribe/unsubscribe/get_message/close).
    return StreamingResponse(
        sse_stream(cast(RedisLike, redis), org.id),
        media_type="text/event-stream",
    )


@router.get("/replay")
async def replay_since(
    org: CurrentOrg,
    session: DbSession,
    since: str = Query(default=""),
) -> list[dict[str, Any]]:
    """Return outbox events for the caller's org with ``seq > since``.

    With ``since`` empty, returns all events. Capped at 500 rows; clients
    page by passing the last received ``seq`` back as the next cursor.
    """
    q = select(EventOutbox).where(EventOutbox.org_id == str(org.id))
    if since:
        q = q.where(EventOutbox.seq > since)
    q = q.order_by(EventOutbox.seq.asc()).limit(500)
    rows = (await session.execute(q)).scalars().all()
    return [
        {
            "seq": r.seq,
            "type": r.type,
            "payload": r.payload,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
