"""Events publisher tests: outbox write + Redis pub/sub fanout."""
from __future__ import annotations

import json

import pytest
from sqlalchemy import select

from app.models.events_outbox import EventOutbox
from app.services.events.publisher import publish_event


@pytest.mark.asyncio
async def test_publish_writes_outbox_row_and_redis(
    async_session, seeded_org, fake_redis
) -> None:
    seq = await publish_event(
        async_session,
        redis=fake_redis,
        org_id=seeded_org.id,
        type="transaction.added",
        payload={"transaction_id": "t1"},
    )
    await async_session.commit()

    # Outbox row
    rows = (
        await async_session.execute(
            select(EventOutbox).where(EventOutbox.org_id == seeded_org.id)
        )
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].type == "transaction.added"
    assert rows[0].payload["transaction_id"] == "t1"
    assert rows[0].seq == seq

    # Redis publish
    channel = f"events:{seeded_org.id}"
    msgs = fake_redis.published[channel]
    assert any(json.loads(m)["type"] == "transaction.added" for m in msgs)
    msg = json.loads(msgs[0])
    assert msg["seq"] == seq
    assert msg["payload"]["transaction_id"] == "t1"
    assert msg["org_id"] == seeded_org.id


@pytest.mark.asyncio
async def test_publish_sequence_is_monotonic(
    async_session, seeded_org, fake_redis
) -> None:
    """Each subsequent publish_event produces a strictly larger seq."""
    seqs = []
    for i in range(3):
        s = await publish_event(
            async_session,
            redis=fake_redis,
            org_id=seeded_org.id,
            type="x",
            payload={"n": i},
        )
        seqs.append(s)
    await async_session.commit()
    assert seqs == sorted(seqs)
    assert len(set(seqs)) == 3
