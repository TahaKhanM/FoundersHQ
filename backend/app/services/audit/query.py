"""Audit log query builder.

Pure, deterministic service. Turns a filter dict into a SQLAlchemy
``select(AuditLog)``. Cursor pagination is stable across rows being
inserted concurrently because the cursor encodes ``(created_at, id)``
and the WHERE clause requires strictly *older* tuples.

The router layer is the only place that touches the wall clock; tests
pass ``now`` in explicitly.
"""
from __future__ import annotations

import base64
import binascii
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from sqlalchemy import Select, and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog

DEFAULT_LIMIT = 50
MAX_LIMIT = 200
DEFAULT_WINDOW_DAYS = 30


@dataclass(frozen=True)
class AuditFilters:
    """All audit log query parameters in one immutable object."""

    org_id: str
    action: str | None = None
    entity_type: str | None = None
    user_id: str | None = None
    from_: datetime | None = None
    to: datetime | None = None
    limit: int = DEFAULT_LIMIT
    # Future-proof: callers may pass additional filters via `extra`.
    extra: dict = field(default_factory=dict)


def _clamp_limit(limit: int) -> int:
    if limit < 1:
        return 1
    if limit > MAX_LIMIT:
        return MAX_LIMIT
    return limit


def build_audit_query(filters: AuditFilters, *, now: datetime) -> Select[tuple[AuditLog]]:
    """Construct the SELECT for the given filters.

    Sort order: newest first, with ``id`` as a stable tiebreaker. The
    composite ordering is what makes the cursor stable.
    """
    q = select(AuditLog).where(AuditLog.org_id == filters.org_id)

    # Date range defaults to last 30 days.
    from_ = filters.from_ if filters.from_ is not None else (now - timedelta(days=DEFAULT_WINDOW_DAYS))
    to = filters.to if filters.to is not None else now
    q = q.where(AuditLog.created_at >= from_).where(AuditLog.created_at <= to)

    if filters.action:
        q = q.where(AuditLog.action == filters.action)
    if filters.entity_type:
        q = q.where(AuditLog.entity_type == filters.entity_type)
    if filters.user_id:
        q = q.where(AuditLog.user_id == filters.user_id)

    q = q.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    return q.limit(_clamp_limit(filters.limit))


# ---- Cursor ----

def encode_cursor(created_at: datetime, row_id: str) -> str:
    """Encode a ``(created_at, id)`` cursor as a URL-safe base64 string."""
    payload = json.dumps({"t": created_at.isoformat(), "id": row_id}).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, str] | None:
    """Decode a cursor. Returns ``None`` on any malformed input.

    Garbage cursors must not crash the API; callers treat ``None`` as
    "no cursor" and return the first page.
    """
    if not cursor:
        return None
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
        payload = json.loads(raw)
        if not isinstance(payload, dict) or "t" not in payload or "id" not in payload:
            return None
        dt_str = payload["t"]
        row_id = payload["id"]
        if not isinstance(dt_str, str) or not isinstance(row_id, str):
            return None
        dt = datetime.fromisoformat(dt_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt, row_id
    except (ValueError, binascii.Error, json.JSONDecodeError):
        return None


def apply_cursor(q: Select[tuple[AuditLog]], cursor: str | None) -> Select[tuple[AuditLog]]:
    """Apply a cursor WHERE clause to a query built by ``build_audit_query``.

    Cursor semantics: return only rows strictly older than the cursor
    row (with ``id`` as tiebreaker for same-microsecond rows).
    """
    if not cursor:
        return q
    decoded = decode_cursor(cursor)
    if decoded is None:
        return q
    dt, row_id = decoded
    return q.where(
        or_(
            AuditLog.created_at < dt,
            and_(AuditLog.created_at == dt, AuditLog.id < row_id),
        )
    )


# ---- Streaming helper (for CSV export) ----

async def iter_audit_rows(
    session: AsyncSession,
    *,
    filters: AuditFilters,
    now: datetime,
    chunk_size: int = 500,
) -> AsyncIterator[AuditLog]:
    """Yield audit rows for the given filters in stable order, in chunks.

    Used by the CSV export endpoint so we don't materialize a 10K+ row
    result set in memory. The filter's ``limit`` is ignored here — export
    returns every row matching the filters.
    """
    last_dt: datetime | None = None
    last_id: str | None = None
    while True:
        q = build_audit_query(
            AuditFilters(
                org_id=filters.org_id,
                action=filters.action,
                entity_type=filters.entity_type,
                user_id=filters.user_id,
                from_=filters.from_,
                to=filters.to,
                limit=chunk_size,
            ),
            now=now,
        )
        if last_dt is not None and last_id is not None:
            q = q.where(
                or_(
                    AuditLog.created_at < last_dt,
                    and_(AuditLog.created_at == last_dt, AuditLog.id < last_id),
                )
            )
        rows = (await session.execute(q)).scalars().all()
        if not rows:
            return
        for row in rows:
            yield row
        if len(rows) < chunk_size:
            return
        last_dt = rows[-1].created_at
        last_id = rows[-1].id
