"""Notifications router: list, count, read, read-all, archive."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import NotificationDTO
from app.deps import CurrentOrg, DbSession
from app.models.notification import Notification

router = APIRouter()


@router.get("", response_model=list[NotificationDTO])
async def list_notifications(
    org: CurrentOrg,
    session: DbSession,
    status: str = Query("unread", description="unread | all"),
    limit: int = Query(20, ge=1, le=100),
):
    q = select(Notification).where(Notification.org_id == org.id)
    if status == "unread":
        q = q.where(Notification.read_at.is_(None), Notification.archived_at.is_(None))
    q = q.order_by(Notification.created_at.desc()).limit(limit)
    result = await session.execute(q)
    items = result.scalars().all()
    return [NotificationDTO.model_validate(n) for n in items]


@router.get("/count")
async def get_notifications_count(
    org: CurrentOrg,
    session: DbSession,
    status: str = Query("unread", description="unread | all"),
):
    q = select(func.count(Notification.id)).where(Notification.org_id == org.id)
    if status == "unread":
        q = q.where(Notification.read_at.is_(None), Notification.archived_at.is_(None))
    total = (await session.execute(q)).scalar() or 0
    return {"count": total}


@router.post("/{notification_id}/read", response_model=NotificationDTO)
async def mark_read(notification_id: str, org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.org_id == org.id,
        )
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(404, "Notification not found")
    n.read_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(n)
    return NotificationDTO.model_validate(n)


@router.post("/read-all")
async def mark_all_read(org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(Notification).where(
            Notification.org_id == org.id,
            Notification.read_at.is_(None),
        )
    )
    items = result.scalars().all()
    now = datetime.now(timezone.utc)
    for n in items:
        n.read_at = now
    await session.commit()
    return {"marked": len(items)}


@router.post("/{notification_id}/archive", response_model=NotificationDTO)
async def archive_notification(notification_id: str, org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.org_id == org.id,
        )
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(404, "Notification not found")
    n.archived_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(n)
    return NotificationDTO.model_validate(n)
