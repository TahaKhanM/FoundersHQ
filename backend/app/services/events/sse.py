"""Async generator that yields SSE-formatted lines from Redis pub/sub.

Each org has a dedicated channel (``events:<org_id>``). Subscribers receive
messages plus periodic ``: keepalive`` comments to keep proxies from closing
the connection.
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Protocol
from uuid import UUID

# 15s matches the heartbeat we document in the skill ("every 25s" is the
# conservative client-facing budget; we err on the side of more keepalives).
KEEPALIVE_SECONDS = 15.0


class PubSubLike(Protocol):
    async def subscribe(self, channel: str) -> None: ...
    async def unsubscribe(self, channel: str) -> None: ...
    async def get_message(
        self, ignore_subscribe_messages: bool = ..., timeout: float = ...
    ) -> dict | None: ...
    async def close(self) -> None: ...


class RedisLike(Protocol):
    def pubsub(self) -> PubSubLike: ...


async def sse_stream(redis: RedisLike, org_id: UUID | str) -> AsyncIterator[bytes]:
    """Yield SSE-framed bytes for the per-org channel.

    Emits one ``: connected`` comment up front, then forwards each pub/sub
    message as ``id: <seq>\\ndata: <json>\\n\\n``. Sends a ``: keepalive``
    comment if no message arrives within ``KEEPALIVE_SECONDS``.
    """
    pubsub = redis.pubsub()
    channel = f"events:{org_id}"
    await pubsub.subscribe(channel)
    try:
        yield b": connected\n\n"
        loop = asyncio.get_event_loop()
        last_keepalive = loop.time()
        while True:
            msg = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=KEEPALIVE_SECONDS
            )
            if msg is not None:
                data = msg["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                payload = json.loads(data)
                seq = payload.get("seq", "")
                yield f"id: {seq}\ndata: {data}\n\n".encode()
                last_keepalive = loop.time()
                continue
            now = loop.time()
            if now - last_keepalive >= KEEPALIVE_SECONDS:
                yield b": keepalive\n\n"
                last_keepalive = now
    finally:
        try:
            await pubsub.unsubscribe(channel)
        finally:
            await pubsub.close()
