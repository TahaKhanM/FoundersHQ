"""FastAPI dependencies: auth, org, DB session, Redis."""
from typing import Annotated
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
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
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    result = await session.execute(select(User).where(User.id == UUID(user_id)))
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
        )
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    result = await session.execute(select(User).where(User.id == UUID(user_id)))
    return result.scalar_one_or_none()


def requires_role(*roles: str):
    """Return a dependency that 403s unless the current user's first membership matches one of `roles`.

    Server-side RBAC gate. The frontend's permissions check is UX only — this is the boundary.
    """
    async def _dep(
        user: Annotated[User, Depends(get_current_user)],
        session: Annotated[AsyncSession, Depends(get_async_session)],
    ) -> Membership:
        result = await session.execute(
            select(Membership)
            .where(Membership.user_id == user.id)
            .order_by(Membership.created_at.asc())
            .limit(1)
        )
        membership = result.scalar_one_or_none()
        if membership is None or membership.role not in roles:
            raise HTTPException(
                status_code=403,
                detail={"code": "forbidden", "message": "Requires role"},
            )
        return membership

    return Depends(_dep)


# Type aliases for route injection
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserOptional = Annotated[User | None, Depends(get_current_user_optional)]
CurrentOrg = Annotated[Org, Depends(get_current_org)]
DbSession = Annotated[AsyncSession, Depends(get_async_session)]
RedisDep = Annotated[aioredis.Redis, Depends(get_redis)]
