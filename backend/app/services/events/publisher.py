"""Outbox-first event publish: durable row, then Redis fanout.

The order matters: write the row, flush, then publish to Redis. If Redis
publish fails, the outbox still holds the event so a reconnecting client
can replay via ``GET /events/replay`` once we recover.
"""
from __future__ import annotations

import itertools
import json
import time
from typing import Any, Protocol
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.events_outbox import EventOutbox


class RedisLike(Protocol):
    """Minimal Redis surface used by the publisher (just `publish`)."""

    async def publish(self, channel: str, message: str) -> int: ...


_counter = itertools.count()


def _next_seq() -> str:
    """Generate a monotonically increasing sequence string.

    Format: ``"{millis:015d}-{counter:09d}"``. Lexicographic order matches
    chronological order, so SQL ``ORDER BY seq`` and string ``> seq``
    comparisons work as expected for cursor-based replay.
    """
    return f"{int(time.time() * 1000):015d}-{next(_counter):09d}"


async def publish_event(
    session: AsyncSession,
    *,
    redis: RedisLike,
    org_id: UUID | str,
    type: str,
    payload: dict[str, Any],
) -> str:
    """Persist an outbox row and publish to Redis. Returns the event seq."""
    seq = _next_seq()
    row = EventOutbox(
        org_id=str(org_id),
        seq=seq,
        type=type,
        payload=payload,
    )
    session.add(row)
    await session.flush()
    message = json.dumps(
        {
            "seq": seq,
            "type": type,
            "payload": payload,
            "org_id": str(org_id),
        }
    )
    await redis.publish(f"events:{org_id}", message)
    return seq
