"""FastAPI dependencies: auth, org, DB session, Redis."""
from typing import Annotated
from uuid import UUID

import jwt
import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.base import get_async_session
from app.models.org import Membership, Org
from app.models.user import User

security = HTTPBearer(auto_error=False)


# Process-wide Redis singleton. Lazily constructed on first injection so
# tests that never touch SSE never open a connection. The async client is
# safe to share across requests; it pools connections internally.
_redis_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Return the per-process ``redis.asyncio.Redis`` singleton.

    Used by routes that call the durable :func:`publish_event` (which
    requires a live Redis to fan out). Best-effort publishes via the
    in-process queue do *not* need this dependency.
    """
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            get_settings().redis_url,
            encoding="utf-8",
            decode_responses=False,
        )
    return _redis_client


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            get_settings().secret_key,
            algorithms=[get_settings().algorithm],
            options={"require": ["exp", "sub"]},
        )
        user_id: str | None = payload.get("sub")
        if not isinstance(user_id, str):
            raise HTTPException(status_code=401, detail="Invalid token")
        subject = str(UUID(user_id))
    except (PyJWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    result = await session.execute(select(User).where(User.id == subject))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_org(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> Org:
    """MVP: user's default org (first membership)."""
    result = await session.execute(
        select(Membership)
        .where(Membership.user_id == user.id)
        .order_by(Membership.created_at.asc())
        .limit(1)
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="No org membership")
    org_result = await session.execute(select(Org).where(Org.id == membership.org_id))
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")
    return org


async def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> User | None:
    """Return current user if valid token present, else None."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials,
            get_settings().secret_key,
            algorithms=[get_settings().algorithm],
            options={"require": ["exp", "sub"]},
        )
        user_id = payload.get("sub")
        if not isinstance(user_id, str):
            return None
        subject = str(UUID(user_id))
    except (PyJWTError, ValueError):
        return None
    result = await session.execute(select(User).where(User.id == subject))
    return result.scalar_one_or_none()


def requires_role(*roles: str):
    """Return a dependency that checks the membership of the resolved organization.

    Server-side RBAC gate. The frontend's permissions check is UX only — this is the boundary.
    """
    async def _dep(
        user: Annotated[User, Depends(get_current_user)],
        org: Annotated[Org, Depends(get_current_org)],
        session: Annotated[AsyncSession, Depends(get_async_session)],
    ) -> Membership:
        result = await session.execute(
            select(Membership)
            .where(Membership.user_id == user.id)
            .where(Membership.org_id == org.id)
        )
        membership = result.scalar_one_or_none()
        if membership is None or membership.role not in roles:
            raise HTTPException(
                status_code=403,
                detail={"code": "forbidden", "message": "Requires role"},
            )
        return membership

    return Depends(_dep)


async def get_writable_org(
    org: Annotated[Org, Depends(get_current_org)],
    _membership: Membership = requires_role("owner", "admin", "member"),
) -> Org:
    """Organization access for operations that change shared business data."""
    return org


async def get_reporting_org(
    org: Annotated[Org, Depends(get_current_org)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> Org:
    """Do not add unlike currencies in legacy reporting aggregates.

    FX rates exist, but reporting lacks an auditable target-currency snapshot.
    Until that is wired, a clear validation error is preferable to false totals.
    """
    from app.models.commitment import Commitment
    from app.models.financial_profile import FinancialProfile
    from app.models.invoice import Invoice
    from app.models.transaction import Transaction
    for model in (Transaction, Invoice, Commitment, FinancialProfile):
        mismatch = await session.scalar(select(model.id).where(
            model.org_id == org.id, model.currency != org.base_currency,
        ).limit(1))
        if mismatch is not None:
            raise HTTPException(422, "Reporting requires data in the organization base currency")
    return org


# Type aliases for route injection
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserOptional = Annotated[User | None, Depends(get_current_user_optional)]
CurrentOrg = Annotated[Org, Depends(get_current_org)]
WritableOrg = Annotated[Org, Depends(get_writable_org)]
ReportingOrg = Annotated[Org, Depends(get_reporting_org)]
DbSession = Annotated[AsyncSession, Depends(get_async_session)]
RedisDep = Annotated[aioredis.Redis, Depends(get_redis)]
