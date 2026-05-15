"""Audit log router: admin-only list + streaming CSV export.

Both endpoints are gated by ``requires_role("owner", "admin")``. The list
endpoint cursor-paginates over ``(created_at, id)``; the export endpoint
streams CSV so we don't materialize a 10K+ row result set in memory.

Read-only by design — these routes do NOT call ``record_audit``: an admin
viewing the audit trail should not append to the audit trail.
"""
from __future__ import annotations

import csv
import io
import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.api.schemas import AuditLogDTO, AuditLogListResponse
from app.deps import CurrentOrg, DbSession, requires_role
from app.models.org import Membership
from app.services.audit.query import (
    DEFAULT_LIMIT,
    MAX_LIMIT,
    AuditFilters,
    apply_cursor,
    build_audit_query,
    encode_cursor,
    iter_audit_rows,
)

router = APIRouter()


def _now() -> datetime:
    """Wall clock. Indirected so tests can monkeypatch if they need to."""
    return datetime.now(UTC)


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    org: CurrentOrg,
    session: DbSession,
    action: str | None = Query(None, max_length=64),
    entity_type: str | None = Query(None, max_length=64),
    user_id: str | None = Query(None, max_length=64),
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = Query(None),
    cursor: str | None = Query(None),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    _membership: Membership = requires_role("owner", "admin"),
):
    """Cursor-paginated audit log.

    Date range defaults to the last 30 days when ``from``/``to`` are
    omitted. Cursor opaquely encodes the last row's ``(created_at, id)``
    so concurrent inserts can't shift the window.
    """
    filters = AuditFilters(
        org_id=org.id,
        action=action,
        entity_type=entity_type,
        user_id=user_id,
        from_=from_,
        to=to,
        limit=limit,
    )
    q = build_audit_query(filters, now=_now())
    q = apply_cursor(q, cursor)
    rows = (await session.execute(q)).scalars().all()

    next_cursor: str | None = None
    if len(rows) == limit:
        last = rows[-1]
        next_cursor = encode_cursor(last.created_at, last.id)

    return AuditLogListResponse(
        items=[AuditLogDTO.model_validate(r) for r in rows],
        next_cursor=next_cursor,
    )


@router.get("/export.csv")
async def export_audit_logs_csv(
    org: CurrentOrg,
    session: DbSession,
    action: str | None = Query(None, max_length=64),
    entity_type: str | None = Query(None, max_length=64),
    user_id: str | None = Query(None, max_length=64),
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = Query(None),
    _membership: Membership = requires_role("owner", "admin"),
):
    """Streaming CSV export of all rows matching the filters.

    No ``limit`` parameter: export returns every row, chunked to keep
    memory bounded. ``Content-Disposition`` triggers a browser download.
    """
    filters = AuditFilters(
        org_id=org.id,
        action=action,
        entity_type=entity_type,
        user_id=user_id,
        from_=from_,
        to=to,
        # `limit` is ignored by iter_audit_rows; it pages internally.
        limit=DEFAULT_LIMIT,
    )

    async def _generate() -> AsyncIterator[bytes]:
        # Header
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "created_at",
            "action",
            "entity_type",
            "entity_id",
            "user_id",
            "request_id",
            "details",
        ])
        yield buf.getvalue().encode("utf-8")

        async for row in iter_audit_rows(session, filters=filters, now=_now()):
            buf = io.StringIO()
            writer = csv.writer(buf)
            # `details` is compact JSON inside the CSV cell.
            writer.writerow([
                row.created_at.isoformat() if row.created_at else "",
                row.action,
                row.entity_type,
                row.entity_id or "",
                row.user_id or "",
                row.request_id or "",
                json.dumps(row.details or {}, separators=(",", ":"), default=str),
            ])
            yield buf.getvalue().encode("utf-8")

    filename = f"audit-log-{datetime.now(UTC).strftime('%Y%m%d-%H%M%S')}.csv"
    return StreamingResponse(
        _generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
