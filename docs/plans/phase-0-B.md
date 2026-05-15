# Phase 0.B — Cross-cutting Backend Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`. TDD per task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Land the load-bearing primitives that every other backend module will rely on: request-id middleware, the `record_audit` helper, a typed error→JSON mapper, an org-scope dev-mode invariant, a Redis-backed events publisher with a durable outbox, and an `/events` SSE endpoint.

**Architecture:** Pure additions; nothing existing is rewritten. All new modules are pure-Python services or thin FastAPI helpers, registered in `app/main.py` at the end. Tests live in `backend/tests/` and use the existing `conftest.py` patterns.

**Tech Stack:** FastAPI middleware, SQLAlchemy 2 async, Alembic, Redis (existing `redis` lib), `httpx-sse` not needed — we emit raw `text/event-stream` via FastAPI `StreamingResponse`.

**Dependencies:** Independent of 0.A, 0.C, 0.D. May run fully in parallel.

**Skills to load:** `foundershq-conventions`, `superpowers:test-driven-development`, `realtime-and-streaming` (for the events publisher + SSE pieces).

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `backend/app/middleware/__init__.py` | create | empty init |
| `backend/app/middleware/request_id.py` | create | per-request UUID, header + state |
| `backend/app/utils/audit.py` | create | `record_audit(...)` helper writing to `audit_logs` |
| `backend/app/utils/errors.py` | create | typed exception → JSON response mapper |
| `backend/app/utils/org_scope.py` | create | SQLAlchemy event listener (dev-mode invariant) |
| `backend/app/services/events/__init__.py` | create | re-exports |
| `backend/app/services/events/publisher.py` | create | `publish(org_id, type, payload)` → outbox + Redis |
| `backend/app/services/events/sse.py` | create | per-org SSE generator |
| `backend/app/models/events_outbox.py` | create | durable outbox model |
| `backend/app/api/routers/events.py` | create | `GET /events` (SSE) + `GET /events/replay` |
| `backend/alembic/versions/<auto>_events_outbox.py` | create (autogenerate) | adds `events_outbox` table |
| `backend/app/main.py` | modify | wire `RequestIdMiddleware`, mount `events` router |
| `backend/app/models/__init__.py` | modify | export `EventOutbox` |
| `backend/alembic/env.py` | modify | import `EventOutbox` for autogenerate |
| `backend/tests/test_request_id.py` | create | request-id header round-trip |
| `backend/tests/test_audit.py` | create | `record_audit` writes a row |
| `backend/tests/test_errors.py` | create | typed exception → JSON shape |
| `backend/tests/test_events_publisher.py` | create | outbox write + redis publish |
| `backend/tests/test_events_sse.py` | create | client receives event + can replay since last id |

---

## Task 1 — RequestIdMiddleware

**Files:**
- Create: `backend/app/middleware/__init__.py` (empty)
- Create: `backend/app/middleware/request_id.py`
- Modify: `backend/app/main.py` (add middleware)
- Create: `backend/tests/test_request_id.py`

- [ ] **Step 1: Write failing test**

`backend/tests/test_request_id.py`:

```python
import uuid

from fastapi.testclient import TestClient

from app.main import app


def test_request_id_header_present_in_response():
    client = TestClient(app)
    r = client.get("/docs")  # any working route
    assert r.status_code == 200
    rid = r.headers.get("x-request-id")
    assert rid is not None
    uuid.UUID(rid)  # must be a valid uuid


def test_request_id_echoed_when_supplied():
    client = TestClient(app)
    rid = "11111111-1111-4111-8111-111111111111"
    r = client.get("/docs", headers={"x-request-id": rid})
    assert r.headers["x-request-id"] == rid
```

- [ ] **Step 2: Run test — confirm fail**

Run: `pytest backend/tests/test_request_id.py -v`
Expected: fail (`x-request-id` not in headers).

- [ ] **Step 3: Implement middleware**

`backend/app/middleware/request_id.py`:

```python
"""Per-request UUID middleware: attaches `request.state.request_id` and `X-Request-ID` header."""
from __future__ import annotations

import uuid
from typing import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

HEADER = "x-request-id"


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        rid = request.headers.get(HEADER) or str(uuid.uuid4())
        request.state.request_id = rid
        response = await call_next(request)
        response.headers[HEADER] = rid
        return response
```

- [ ] **Step 4: Wire in `app/main.py`**

After the existing `CORSMiddleware` block, add:

```python
from app.middleware.request_id import RequestIdMiddleware
app.add_middleware(RequestIdMiddleware)
```

- [ ] **Step 5: Run test — confirm pass**

Run: `pytest backend/tests/test_request_id.py -v`
Expected: both tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/middleware/ backend/app/main.py backend/tests/test_request_id.py
git commit -m "feat(phase-0.B): request-id middleware"
```

---

## Task 2 — `record_audit` helper

**Files:**
- Create: `backend/app/utils/audit.py`
- Create: `backend/tests/test_audit.py`

The `audit_logs` model already exists at `backend/app/models/audit.py`. Inspect its column names with `Read` before writing.

- [ ] **Step 1: Inspect audit model**

Open `backend/app/models/audit.py`. Note the column names (likely: `id`, `org_id`, `user_id`, `action`, `entity_type`, `entity_id`, `details JSONB`, `created_at`, `request_id`).
If `request_id` is absent, add it via alembic in this task; otherwise skip the migration step.

- [ ] **Step 2: Failing test**

`backend/tests/test_audit.py`:

```python
import uuid

import pytest

from app.utils.audit import record_audit


@pytest.mark.asyncio
async def test_record_audit_writes_a_row(async_session, seeded_org, seeded_user):
    await record_audit(
        async_session,
        org=seeded_org,
        user=seeded_user,
        action="transaction.updated",
        entity_type="transaction",
        entity_id=str(uuid.uuid4()),
        details={"field": "category_id"},
        request_id="req-1",
    )
    await async_session.commit()
    from app.models.audit import AuditLog
    from sqlalchemy import select

    rows = (await async_session.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(1))).scalars().all()
    assert len(rows) == 1
    row = rows[0]
    assert row.action == "transaction.updated"
    assert row.org_id == seeded_org.id
    assert row.details["field"] == "category_id"
```

If `seeded_org` / `seeded_user` fixtures don't exist, define them in `tests/conftest.py` modeling on existing fixtures.

- [ ] **Step 3: Run test — confirm fail**

Run: `pytest backend/tests/test_audit.py -v`
Expected: `ImportError: cannot import name 'record_audit'`.

- [ ] **Step 4: Implement helper**

`backend/app/utils/audit.py`:

```python
"""Audit-log helper. Every mutation route must call this."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.org import Org
from app.models.user import User


async def record_audit(
    session: AsyncSession,
    *,
    org: Org,
    user: User | None,
    action: str,
    entity_type: str,
    entity_id: str | UUID,
    details: dict[str, Any] | None = None,
    request_id: str | None = None,
) -> AuditLog:
    row = AuditLog(
        org_id=org.id,
        user_id=user.id if user else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        details=details or {},
        request_id=request_id,
    )
    session.add(row)
    await session.flush()
    return row
```

If the model doesn't have a `request_id` column, omit it from the constructor and add a migration in a separate alembic revision named `add_request_id_to_audit_logs`.

- [ ] **Step 5: Run test — confirm pass**

Run: `pytest backend/tests/test_audit.py -v`

- [ ] **Step 6: Commit**

```bash
git add backend/app/utils/audit.py backend/tests/test_audit.py backend/tests/conftest.py
git commit -m "feat(phase-0.B): record_audit helper"
```

---

## Task 3 — Typed error → JSON mapper

**Files:**
- Create: `backend/app/utils/errors.py`
- Modify: `backend/app/main.py` (register exception handlers)
- Create: `backend/tests/test_errors.py`

- [ ] **Step 1: Failing test**

`backend/tests/test_errors.py`:

```python
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app.middleware.request_id import RequestIdMiddleware
from app.utils.errors import AppError, register_error_handlers


def test_app_error_returns_typed_json():
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)
    register_error_handlers(app)
    router = APIRouter()

    @router.get("/boom")
    def boom():
        raise AppError(code="thing_not_found", message="missing", status_code=404, details={"id": "x"})

    app.include_router(router)
    client = TestClient(app)
    r = client.get("/boom")
    assert r.status_code == 404
    body = r.json()
    assert body["code"] == "thing_not_found"
    assert body["message"] == "missing"
    assert body["details"] == {"id": "x"}
    assert "request_id" in body
```

- [ ] **Step 2: Run test — confirm fail**

- [ ] **Step 3: Implement**

`backend/app/utils/errors.py`:

```python
"""Typed exception → JSON response. Every error includes request_id from middleware."""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, *, code: str, message: str, status_code: int = 400, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        rid = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "request_id": rid,
            },
        )
```

- [ ] **Step 4: Register in `app/main.py`**

```python
from app.utils.errors import register_error_handlers
register_error_handlers(app)
```

- [ ] **Step 5: Run test — confirm pass**

- [ ] **Step 6: Commit**

```bash
git add backend/app/utils/errors.py backend/app/main.py backend/tests/test_errors.py
git commit -m "feat(phase-0.B): typed AppError + JSON mapper"
```

---

## Task 4 — Org-scope dev invariant (SQLAlchemy listener)

**Files:**
- Create: `backend/app/utils/org_scope.py`
- Modify: `backend/app/models/base.py` (register listener in dev)
- Create: `backend/tests/test_org_scope_invariant.py`

This raises a `RuntimeError` in dev / test if an org-scoped row is flushed without `org_id`. In production (`ENV=prod`), it logs but does not raise.

- [ ] **Step 1: Failing test**

`backend/tests/test_org_scope_invariant.py`:

```python
import pytest
from app.models.transaction import Transaction
from app.utils.org_scope import OrgScopeViolation


@pytest.mark.asyncio
async def test_inserting_org_scoped_row_without_org_id_raises(async_session):
    t = Transaction(merchant="x", amount=1, date="2026-01-01", category_id=None, org_id=None)
    async_session.add(t)
    with pytest.raises(OrgScopeViolation):
        await async_session.flush()
```

- [ ] **Step 2: Implement**

`backend/app/utils/org_scope.py`:

```python
"""Dev invariant: every org-scoped insert must carry org_id."""
from __future__ import annotations

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.config import get_settings


class OrgScopeViolation(RuntimeError):
    pass


def register_org_scope_listener(SessionClass: type) -> None:
    settings = get_settings()
    raise_on_violation = settings.env != "prod"

    @event.listens_for(SessionClass, "before_flush")
    def _check(session: Session, flush_context, instances) -> None:
        for obj in session.new:
            org_id_col = getattr(obj.__class__, "__table__", None)
            if org_id_col is None:
                continue
            if "org_id" not in obj.__class__.__table__.columns:
                continue
            if getattr(obj, "org_id", None) is None:
                msg = f"{obj.__class__.__name__} flushed without org_id"
                if raise_on_violation:
                    raise OrgScopeViolation(msg)
```

- [ ] **Step 3: Register in `app/models/base.py`**

After session class is defined, call `register_org_scope_listener(AsyncSession)` (or the sync session class — pick the one that runs `before_flush`).

- [ ] **Step 4: Run test — confirm pass.**

- [ ] **Step 5: Commit**

```bash
git add backend/app/utils/org_scope.py backend/app/models/base.py backend/tests/test_org_scope_invariant.py
git commit -m "feat(phase-0.B): org-scope dev invariant"
```

---

## Task 5 — `events_outbox` table + model

**Files:**
- Create: `backend/app/models/events_outbox.py`
- Modify: `backend/app/models/__init__.py` (export `EventOutbox`)
- Modify: `backend/alembic/env.py` (import in target_metadata branch)
- Create: alembic migration via autogenerate

- [ ] **Step 1: Create model**

`backend/app/models/events_outbox.py`:

```python
"""Durable event outbox for SSE / webhook fanout."""
from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.sql import func

from app.models.base import Base, gen_uuid


class EventOutbox(Base):
    __tablename__ = "events_outbox"

    id = Column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    org_id = Column(PG_UUID(as_uuid=False), nullable=False, index=True)
    seq = Column(String, nullable=False)  # monotonic per org, e.g. snowflake or millis-prefixed
    type = Column(String, nullable=False)
    payload = Column(JSONB, nullable=False, server_default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_events_outbox_org_seq", "org_id", "seq"),
    )
```

- [ ] **Step 2: Export in `app/models/__init__.py`**

Add: `from .events_outbox import EventOutbox`.

- [ ] **Step 3: Ensure `alembic/env.py` imports models**

Verify the line `from app.models import ...` includes the package import so autogenerate sees `EventOutbox`. Pattern: import the package module then reference `Base.metadata`.

- [ ] **Step 4: Autogenerate migration**

Run (from `backend/`): `alembic revision -m "events_outbox" --autogenerate`
Review the generated file in `backend/alembic/versions/` — confirm it adds the table and index.

- [ ] **Step 5: Apply locally**

Run: `alembic upgrade head`
Expected: migration applies cleanly.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/events_outbox.py backend/app/models/__init__.py backend/alembic/
git commit -m "feat(phase-0.B): events_outbox table"
```

---

## Task 6 — Events publisher service

**Files:**
- Create: `backend/app/services/events/__init__.py`
- Create: `backend/app/services/events/publisher.py`
- Create: `backend/tests/test_events_publisher.py`

- [ ] **Step 1: Failing test**

`backend/tests/test_events_publisher.py`:

```python
import json
import pytest

from app.services.events.publisher import publish_event


@pytest.mark.asyncio
async def test_publish_writes_outbox_row_and_redis(async_session, seeded_org, fake_redis):
    seq = await publish_event(
        async_session,
        redis=fake_redis,
        org_id=seeded_org.id,
        type="transaction.added",
        payload={"transaction_id": "t1"},
    )
    await async_session.commit()

    # outbox
    from app.models.events_outbox import EventOutbox
    from sqlalchemy import select
    rows = (await async_session.execute(select(EventOutbox).where(EventOutbox.org_id == seeded_org.id))).scalars().all()
    assert len(rows) == 1
    assert rows[0].type == "transaction.added"
    assert rows[0].payload["transaction_id"] == "t1"
    assert rows[0].seq == seq

    # redis
    msgs = fake_redis.published[f"events:{seeded_org.id}"]
    assert any(json.loads(m)["type"] == "transaction.added" for m in msgs)
```

The `fake_redis` fixture should be a tiny in-memory stand-in for `redis.asyncio.Redis` with `publish(channel, message)` capturing calls into `self.published: dict[str, list[str]]`. Put it in `tests/conftest.py`.

- [ ] **Step 2: Implement**

`backend/app/services/events/publisher.py`:

```python
"""Outbox-first event publish: durable row, then Redis fanout."""
from __future__ import annotations

import json
import time
from typing import Any, Protocol
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.events_outbox import EventOutbox


class RedisLike(Protocol):
    async def publish(self, channel: str, message: str) -> int: ...


def _next_seq() -> str:
    # millis + nanos suffix for monotonicity within a process
    return f"{int(time.time() * 1000):015d}-{time.perf_counter_ns() % 10**6:06d}"


async def publish_event(
    session: AsyncSession,
    *,
    redis: RedisLike,
    org_id: UUID | str,
    type: str,
    payload: dict[str, Any],
) -> str:
    seq = _next_seq()
    row = EventOutbox(org_id=str(org_id), seq=seq, type=type, payload=payload)
    session.add(row)
    await session.flush()
    message = json.dumps({"seq": seq, "type": type, "payload": payload, "org_id": str(org_id)})
    await redis.publish(f"events:{org_id}", message)
    return seq
```

`backend/app/services/events/__init__.py`:

```python
from .publisher import publish_event

__all__ = ["publish_event"]
```

- [ ] **Step 3: Run test — confirm pass.**

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/events/ backend/tests/test_events_publisher.py
git commit -m "feat(phase-0.B): events publisher (outbox + redis)"
```

---

## Task 7 — `/events` SSE router

**Files:**
- Create: `backend/app/services/events/sse.py`
- Create: `backend/app/api/routers/events.py`
- Modify: `backend/app/main.py` (mount router)
- Create: `backend/tests/test_events_sse.py`

- [ ] **Step 1: Failing test**

`backend/tests/test_events_sse.py`:

```python
import asyncio
import json
import pytest
from httpx import AsyncClient

from app.main import app
from app.services.events.publisher import publish_event


@pytest.mark.asyncio
async def test_sse_delivers_events_after_subscription(async_session, seeded_org, seeded_user_token, fake_redis):
    async with AsyncClient(app=app, base_url="http://test") as client:
        async with client.stream("GET", "/events", headers={"Authorization": f"Bearer {seeded_user_token}"}) as resp:
            assert resp.status_code == 200
            # Publish from another task once stream is open
            async def emit():
                await asyncio.sleep(0.05)
                await publish_event(async_session, redis=fake_redis, org_id=seeded_org.id, type="ping", payload={"ok": True})
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


@pytest.mark.asyncio
async def test_replay_since_returns_past_events(async_session, seeded_org, seeded_user_token, fake_redis):
    seq1 = await publish_event(async_session, redis=fake_redis, org_id=seeded_org.id, type="a", payload={})
    await async_session.commit()
    async with AsyncClient(app=app, base_url="http://test") as client:
        r = await client.get(f"/events/replay?since={seq1}", headers={"Authorization": f"Bearer {seeded_user_token}"})
        assert r.status_code == 200
        events = r.json()
        # since the seq passed equals seq1, returned events are strictly after seq1
        assert all(e["seq"] > seq1 for e in events)
```

- [ ] **Step 2: Implement SSE generator + router**

`backend/app/services/events/sse.py`:

```python
"""Async generator that yields SSE-formatted lines from Redis pub/sub."""
from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator
from uuid import UUID

import redis.asyncio as aioredis


async def sse_stream(redis: aioredis.Redis, org_id: UUID | str) -> AsyncIterator[bytes]:
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"events:{org_id}")
    try:
        yield b": connected\n\n"
        last_keepalive = asyncio.get_event_loop().time()
        while True:
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)
            if msg is not None:
                data = msg["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                payload = json.loads(data)
                yield f"id: {payload.get('seq', '')}\ndata: {data}\n\n".encode()
            now = asyncio.get_event_loop().time()
            if now - last_keepalive > 15:
                yield b": keepalive\n\n"
                last_keepalive = now
    finally:
        await pubsub.unsubscribe(f"events:{org_id}")
        await pubsub.close()
```

`backend/app/api/routers/events.py`:

```python
"""SSE endpoint per org + replay-since endpoint for catch-up."""
from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.deps import CurrentOrg, DbSession
from app.models.events_outbox import EventOutbox
from app.services.events.sse import sse_stream
from app.config import get_settings

import redis.asyncio as aioredis

router = APIRouter()


def _get_redis() -> aioredis.Redis:
    return aioredis.from_url(get_settings().redis_url, encoding="utf-8", decode_responses=False)


@router.get("")
async def events_stream(org: CurrentOrg) -> StreamingResponse:
    redis = _get_redis()
    return StreamingResponse(sse_stream(redis, org.id), media_type="text/event-stream")


@router.get("/replay")
async def replay_since(org: CurrentOrg, session: DbSession, since: str = Query("")) -> list[dict]:
    q = select(EventOutbox).where(EventOutbox.org_id == str(org.id))
    if since:
        q = q.where(EventOutbox.seq > since)
    q = q.order_by(EventOutbox.seq.asc()).limit(500)
    rows = (await session.execute(q)).scalars().all()
    return [{"seq": r.seq, "type": r.type, "payload": r.payload, "created_at": r.created_at.isoformat()} for r in rows]
```

- [ ] **Step 3: Mount in `app/main.py`**

```python
from app.api.routers import events
app.include_router(events.router, prefix="/events", tags=["events"])
```

- [ ] **Step 4: Run tests — confirm pass.**

If `fake_redis` fixture isn't sufficient for the real pub/sub path, the streaming test may need to be marked `@pytest.mark.integration` and skipped in unit runs; the `replay` test should still pass against the DB only.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/events/sse.py backend/app/api/routers/events.py backend/app/main.py backend/tests/test_events_sse.py
git commit -m "feat(phase-0.B): SSE /events + /events/replay"
```

---

## Success criteria

- `pytest backend/tests/test_request_id.py backend/tests/test_audit.py backend/tests/test_errors.py backend/tests/test_org_scope_invariant.py backend/tests/test_events_publisher.py backend/tests/test_events_sse.py` all pass (or, for the live SSE test, is marked skip in unit runs).
- `alembic upgrade head` cleanly creates `events_outbox`.
- A request to any route includes an `x-request-id` header.
- A FastAPI route can `raise AppError(...)` and get a typed JSON response.
- `record_audit(...)` is the single helper every mutation route will call (mutations themselves are not in scope here — just the helper).

## Out of scope

- Wiring `record_audit` into existing routes (that's phase 1).
- Wiring `publish_event` into existing routes (that's phase 2).
- Authentication/RBAC additions beyond what `CurrentOrg` already provides.

## Verification

- [ ] `make verify` returns 0 (lint + typecheck + tests) for the new files at minimum.
- [ ] `curl -N -H 'Authorization: Bearer <token>' http://localhost:8000/events` shows `: connected` then keepalives.
- [ ] Inserting a `Transaction` without `org_id` raises `OrgScopeViolation` in dev.
