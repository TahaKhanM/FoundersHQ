"""Notifications router: list, count, read, read-all, archive, snooze, preferences.

Mutations write audit rows and publish ``notification.updated`` events via
the in-process best-effort queue so the bell/inbox can react in real time.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_, select

from app.api.schemas import (
    NotificationDTO,
    NotificationPreferenceDTO,
    NotificationPreferenceUpdate,
    NotificationSnoozeRequest,
)
from app.deps import CurrentOrg, CurrentUser, DbSession
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.services.events import publish_event_best_effort
from app.utils.audit import record_audit

log = logging.getLogger(__name__)

router = APIRouter()


# Known notification types. Used to expand preferences to a stable list when
# the caller has no rows yet. Generators only emit these strings today; new
# types must be added here (and in the FE preferences UI).
KNOWN_NOTIFICATION_TYPES: tuple[str, ...] = ("spending", "invoice", "runway", "funding", "system")


def _safe_publish(org_id: str, event_type: str, payload: dict) -> None:
    """Fire-and-forget event publish. Never blocks the DB commit."""
    try:
        publish_event_best_effort(org_id, event_type, payload)
    except Exception:  # noqa: BLE001
        log.exception("publish_event failed for %s", event_type)


def _serialize(n: Notification) -> dict:
    """Compact dict for SSE payload — keep it small."""
    return {
        "id": n.id,
        "org_id": n.org_id,
        "type": n.type,
        "severity": n.severity,
        "title": n.title,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "archived_at": n.archived_at.isoformat() if n.archived_at else None,
        "snoozed_until": n.snoozed_until.isoformat() if n.snoozed_until else None,
    }


def _resolve_snooze_until(duration: str, now: datetime | None = None) -> datetime:
    """Map the discrete snooze duration to an absolute UTC timestamp.

    Pure function — accepts ``now`` for testability. The router defaults it.
    Monday is the next Monday at 09:00 local-equivalent; we keep it in UTC
    for v1 because we do not yet store user time zones.
    """
    now = now or datetime.now(UTC)
    if duration == "1h":
        return now + timedelta(hours=1)
    if duration == "4h":
        return now + timedelta(hours=4)
    if duration == "24h":
        return now + timedelta(hours=24)
    if duration == "monday":
        # Days until next Monday (1=Tue..6=Sun -> 6..1; Mon=0 -> 7 to avoid "today").
        weekday = now.weekday()
        days_ahead = (7 - weekday) if weekday != 0 else 7
        return (now + timedelta(days=days_ahead)).replace(
            hour=9, minute=0, second=0, microsecond=0
        )
    raise ValueError(f"unsupported snooze duration: {duration}")


# ---------------------------------------------------------------------------
# Listing + count
# ---------------------------------------------------------------------------


@router.get("", response_model=list[NotificationDTO])
async def list_notifications(
    org: CurrentOrg,
    session: DbSession,
    status: Literal["unread", "all", "archived"] = Query("unread"),
    limit: int = Query(20, ge=1, le=100),
):
    """List notifications scoped to the current org.

    ``unread`` excludes read, archived, **and** currently-snoozed items.
    ``archived`` returns only archived items.
    ``all`` returns everything regardless of state.
    """
    now = datetime.now(UTC)
    q = select(Notification).where(Notification.org_id == org.id)
    if status == "unread":
        q = q.where(
            Notification.read_at.is_(None),
            Notification.archived_at.is_(None),
        ).where(
            or_(
                Notification.snoozed_until.is_(None),
                Notification.snoozed_until <= now,
            )
        )
    elif status == "archived":
        q = q.where(Notification.archived_at.is_not(None))
    q = q.order_by(Notification.created_at.desc()).limit(limit)
    result = await session.execute(q)
    items = result.scalars().all()
    return [NotificationDTO.model_validate(n) for n in items]


@router.get("/count")
async def get_notifications_count(
    org: CurrentOrg,
    session: DbSession,
    status: Literal["unread", "all", "archived"] = Query("unread"),
):
    from sqlalchemy import func as sa_func

    now = datetime.now(UTC)
    q = select(sa_func.count(Notification.id)).where(Notification.org_id == org.id)
    if status == "unread":
        q = q.where(
            Notification.read_at.is_(None),
            Notification.archived_at.is_(None),
        ).where(
            or_(
                Notification.snoozed_until.is_(None),
                Notification.snoozed_until <= now,
            )
        )
    elif status == "archived":
        q = q.where(Notification.archived_at.is_not(None))
    total = (await session.execute(q)).scalar() or 0
    return {"count": total}


# ---------------------------------------------------------------------------
# Preferences (must be declared before /{notification_id} routes so the
# string "preferences" doesn't get parsed as a UUID path param).
# ---------------------------------------------------------------------------


@router.get("/preferences", response_model=list[NotificationPreferenceDTO])
async def list_preferences(user: CurrentUser, session: DbSession):
    """Return one row per known type. Missing rows default to both-true."""
    existing = (
        await session.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user.id)
        )
    ).scalars().all()
    by_type = {p.type: p for p in existing}
    out: list[NotificationPreferenceDTO] = []
    for t in KNOWN_NOTIFICATION_TYPES:
        if t in by_type:
            out.append(NotificationPreferenceDTO.model_validate(by_type[t]))
        else:
            out.append(NotificationPreferenceDTO(type=t, in_app=True, email=True))
    return out


@router.put("/preferences", response_model=list[NotificationPreferenceDTO])
async def update_preferences(
    body: NotificationPreferenceUpdate,
    org: CurrentOrg,
    user: CurrentUser,
    session: DbSession,
):
    """Upsert one row per type in the request. Audits per-type."""
    existing_rows = (
        await session.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user.id)
        )
    ).scalars().all()
    by_type = {p.type: p for p in existing_rows}

    updated_types: list[str] = []
    for pref in body.preferences:
        if pref.type not in KNOWN_NOTIFICATION_TYPES:
            raise HTTPException(
                status_code=400,
                detail={"code": "unknown_type", "message": f"Unknown notification type: {pref.type}"},
            )
        row = by_type.get(pref.type)
        if row is None:
            row = NotificationPreference(
                user_id=user.id, type=pref.type, in_app=pref.in_app, email=pref.email
            )
            session.add(row)
        else:
            row.in_app = pref.in_app
            row.email = pref.email
        updated_types.append(pref.type)

    await session.flush()
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="notification_preference.updated",
        entity_type="notification_preference",
        entity_id=user.id,
        details={"types": updated_types},
    )
    await session.commit()

    # Return the full preferences view.
    return await list_preferences(user, session)


# ---------------------------------------------------------------------------
# Mutations on a single notification
# ---------------------------------------------------------------------------


async def _load_notification_or_404(notification_id: str, org_id: str, session) -> Notification:
    n = (
        await session.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.org_id == org_id,
            )
        )
    ).scalar_one_or_none()
    if not n:
        raise HTTPException(404, "Notification not found")
    return n


@router.post("/{notification_id}/read", response_model=NotificationDTO)
async def mark_read(
    notification_id: str, org: CurrentOrg, user: CurrentUser, session: DbSession
):
    n = await _load_notification_or_404(notification_id, org.id, session)
    n.read_at = datetime.now(UTC)
    await session.flush()
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="notification.read",
        entity_type="notification",
        entity_id=n.id,
    )
    await session.commit()
    await session.refresh(n)
    _safe_publish(org.id, "notification.updated", {**_serialize(n), "status": "read"})
    return NotificationDTO.model_validate(n)


@router.post("/read-all")
async def mark_all_read(org: CurrentOrg, user: CurrentUser, session: DbSession):
    result = await session.execute(
        select(Notification).where(
            Notification.org_id == org.id,
            Notification.read_at.is_(None),
        )
    )
    items = result.scalars().all()
    now = datetime.now(UTC)
    for n in items:
        n.read_at = now
    await session.flush()
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="notification.read_all",
        entity_type="notification",
        entity_id="batch",
        details={"count": len(items)},
    )
    await session.commit()
    _safe_publish(org.id, "notification.updated", {"status": "read_all", "count": len(items)})
    return {"marked": len(items)}


@router.post("/{notification_id}/archive", response_model=NotificationDTO)
async def archive_notification(
    notification_id: str, org: CurrentOrg, user: CurrentUser, session: DbSession
):
    n = await _load_notification_or_404(notification_id, org.id, session)
    n.archived_at = datetime.now(UTC)
    await session.flush()
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="notification.archived",
        entity_type="notification",
        entity_id=n.id,
    )
    await session.commit()
    await session.refresh(n)
    _safe_publish(org.id, "notification.updated", {**_serialize(n), "status": "archived"})
    return NotificationDTO.model_validate(n)


@router.post("/{notification_id}/snooze", response_model=NotificationDTO)
async def snooze_notification(
    notification_id: str,
    body: NotificationSnoozeRequest,
    org: CurrentOrg,
    user: CurrentUser,
    session: DbSession,
):
    n = await _load_notification_or_404(notification_id, org.id, session)
    snoozed_until = _resolve_snooze_until(body.duration)
    n.snoozed_until = snoozed_until
    await session.flush()
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="notification.snoozed",
        entity_type="notification",
        entity_id=n.id,
        details={"duration": body.duration, "until": snoozed_until.isoformat()},
    )
    await session.commit()
    await session.refresh(n)
    _safe_publish(
        org.id,
        "notification.updated",
        {**_serialize(n), "status": "snoozed", "duration": body.duration},
    )
    return NotificationDTO.model_validate(n)
