"""Insights router — list, dismiss, manual run trigger.

``GET /insights`` returns active insights for the current org, newest
first. ``POST /insights/{id}/dismiss`` dismisses one row; ``POST
/insights/run`` is an admin-only manual trigger that calls the
deterministic orchestrator for the current org. The Celery beat task
``run_insights_nightly`` is the production entry point — the manual
trigger is meant for tests and "demo it for me" moments.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from datetime import date as date_cls
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.api.schemas import InsightDTO, InsightListResponse, InsightRunResponse
from app.deps import CurrentOrg, CurrentUser, DbSession, requires_role
from app.models.insight import Insight
from app.models.org import Membership
from app.services.events import publish_event_best_effort
from app.services.insights.run_all import run_all
from app.utils.audit import record_audit

router = APIRouter()
log = logging.getLogger(__name__)


def _safe_publish(org_id: str, event_type: str, payload: dict) -> None:
    try:
        publish_event_best_effort(org_id, event_type, payload)
    except Exception:  # noqa: BLE001
        log.exception("publish_event failed for %s", event_type)


@router.get("", response_model=InsightListResponse)
async def list_insights(
    org: CurrentOrg,
    _user: CurrentUser,
    session: DbSession,
    status: Literal["active", "dismissed", "all"] = Query("active"),
    limit: int = Query(50, ge=1, le=200),
):
    """List insights scoped to the current org.

    ``active`` (default) excludes dismissed rows. ``dismissed`` is the
    inverse for "let me audit what we ignored". ``all`` is intentionally
    last because the inbox lives on the active set.
    """
    q = select(Insight).where(Insight.org_id == org.id)
    if status == "active":
        q = q.where(Insight.status == "active")
    elif status == "dismissed":
        q = q.where(Insight.status == "dismissed")
    q = q.order_by(Insight.created_at.desc()).limit(limit)
    rows = (await session.execute(q)).scalars().all()
    return InsightListResponse(
        items=[InsightDTO.model_validate(r) for r in rows],
        next_cursor=None,
    )


@router.post("/{insight_id}/dismiss", response_model=InsightDTO)
async def dismiss_insight(
    insight_id: str,
    org: CurrentOrg,
    user: CurrentUser,
    session: DbSession,
):
    """Dismiss one insight. 404s on cross-org access.

    Dismissing is non-destructive — the row stays for audit. Re-running
    the orchestrator will NOT re-create the same finding because the
    dedupe key looks at all insight rows (active or dismissed); only a
    change in the underlying evidence (different transaction ids, a new
    invoice id) resurfaces the insight.
    """
    row = (
        await session.execute(
            select(Insight).where(
                Insight.id == insight_id,
                Insight.org_id == org.id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Insight not found")
    if row.status == "dismissed":
        # Idempotent: don't audit twice.
        return InsightDTO.model_validate(row)
    row.status = "dismissed"
    row.dismissed_at = datetime.now(UTC)
    await session.flush()
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="insight.dismissed",
        entity_type="insight",
        entity_id=row.id,
        details={"type": row.type, "severity": row.severity},
    )
    _safe_publish(
        org.id,
        "insight.updated",
        {
            "id": row.id,
            "org_id": row.org_id,
            "status": "dismissed",
            "type": row.type,
        },
    )
    return InsightDTO.model_validate(row)


@router.post("/run", response_model=InsightRunResponse)
async def trigger_run(
    org: CurrentOrg,
    user: CurrentUser,
    session: DbSession,
    _membership: Membership = requires_role("owner", "admin"),
):
    """Manually run all generators for the current org. Admin-only.

    Useful for tests and demos; the production path is the nightly
    Celery beat task. Idempotent: re-running the same day with the same
    facts creates zero new rows.
    """
    today = date_cls.today()
    created = await run_all(org_id=org.id, today=today, session=session)
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="insight.run",
        entity_type="org",
        entity_id=org.id,
        details={"created": len(created)},
    )
    return InsightRunResponse(
        created=len(created),
        created_ids=[r.id for r in created],
    )
