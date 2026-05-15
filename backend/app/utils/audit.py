"""Audit-log helper. Every mutation route must call this.

Inserts a row into `audit_logs` with structured metadata. The session is
flushed but not committed: the caller (a FastAPI route, via the
``get_async_session`` dependency) controls commit/rollback so an audit row
rolls back with the mutation if anything downstream raises.
"""
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
    """Persist an audit-log row scoped to ``org``.

    Args:
        session: Active async session; caller commits.
        org: Org the mutation acted on.
        user: Authenticated user; ``None`` for background jobs.
        action: Verb-style identifier, e.g. ``"transaction.updated"``.
        entity_type: Subject noun, e.g. ``"transaction"``.
        entity_id: Subject id (UUID or string).
        details: Optional structured payload (JSONB).
        request_id: Correlates with ``X-Request-ID`` of the originating request.

    Returns:
        The persisted :class:`AuditLog` row (post-flush).
    """
    row = AuditLog(
        org_id=org.id,
        user_id=user.id if user is not None else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        details=details or {},
        request_id=request_id,
    )
    session.add(row)
    await session.flush()
    return row
