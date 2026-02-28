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
    action: str,
    entity_type: str,
    entity_id: str | UUID,
    org: Org | None = None,
    user: User | None = None,
    org_id: str | None = None,
    user_id: str | None = None,
    details: dict[str, Any] | None = None,
    request_id: str | None = None,
) -> AuditLog:
    """Persist an audit-log row scoped to an org.

    Accepts either object forms (``org=``, ``user=``) or id forms
    (``org_id=``, ``user_id=``). Exactly one of each pair is required for
    org; user is optional (background jobs).
    """
    final_org_id = org_id if org_id is not None else (org.id if org is not None else None)
    if final_org_id is None:
        raise ValueError("record_audit requires either `org` or `org_id`")
    final_user_id = user_id if user_id is not None else (user.id if user is not None else None)
    row = AuditLog(
        org_id=final_org_id,
        user_id=final_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        details=details or {},
        request_id=request_id,
    )
    session.add(row)
    await session.flush()
    return row
