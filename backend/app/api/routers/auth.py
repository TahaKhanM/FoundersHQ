"""Auth router: register, login, me, logout, forgot/reset password, accept invite."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    AcceptInviteRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    SessionDTO,
    UserDTO,
)
from app.config import get_settings
from app.deps import CurrentUser, get_async_session, get_current_user
from app.models.base import gen_uuid
from app.models.invitation import Invitation
from app.models.org import Membership, Org
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.auth.tokens import (
    consume_invitation_token,
    consume_reset_token,
    generate_token,
)
from app.services.events import publish_event
from app.utils.audit import record_audit
from app.utils.hashing import hash_password, verify_password
from app.utils.security import create_access_token

router = APIRouter()
log = logging.getLogger(__name__)


def _safe_publish(org_id: str, event_type: str, payload: dict) -> None:
    """publish_event wrapped so a broker outage cannot fail the DB commit."""
    try:
        publish_event(org_id, event_type, payload)
    except Exception:  # noqa: BLE001 — defensive: never let pubsub poison a transaction.
        log.exception("publish_event failed for %s", event_type)


@router.post("/register", response_model=RegisterResponse)
async def register(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        id=gen_uuid(),
        email=body.email,
        password_hash=hash_password(body.password),
    )
    session.add(user)
    org = Org(id=gen_uuid(), name=f"{body.email}'s Org")
    session.add(org)
    session.add(Membership(id=gen_uuid(), user_id=user.id, org_id=org.id, role="owner"))
    await session.flush()
    await session.refresh(user)
    token = create_access_token(user.id)
    return RegisterResponse(
        user=UserDTO.model_validate(user),
        access_token=token,
    )


@router.post("/login", response_model=SessionDTO)
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id)
    return SessionDTO(access_token=token, user=UserDTO.model_validate(user))


@router.get("/me", response_model=UserDTO)
async def me(current_user: CurrentUser):
    return UserDTO.model_validate(current_user)


@router.post("/logout", status_code=204)
async def logout():
    return None


# ----- Phase 1.A: password reset -----

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_async_session),
):
    """Always return ok. If the user exists, create a reset token; in dev, surface it."""
    result = await session.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None:
        # do not leak existence; do not audit a no-op
        return ForgotPasswordResponse(ok=True, dev_token=None)

    raw, token_hash = generate_token()
    prt = PasswordResetToken(
        id=gen_uuid(),
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    session.add(prt)
    await session.flush()

    # audit + event; safe org_id is not available — use user's first org if any.
    org_id = await _first_org_id(session, user.id)
    if org_id:
        await record_audit(
            session,
            org_id=org_id,
            user_id=user.id,
            action="auth.password_reset_requested",
            entity_type="user",
            entity_id=user.id,
        )
        _safe_publish(org_id, "auth.password_reset_requested", {"user_id": user.id})

    settings = get_settings()
    dev_token = raw if settings.env != "prod" else None
    return ForgotPasswordResponse(ok=True, dev_token=dev_token)


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    body: ResetPasswordRequest,
    session: AsyncSession = Depends(get_async_session),
):
    prt = await consume_reset_token(session, body.token)
    if prt is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_token", "message": "Token invalid or expired"},
        )

    user = (await session.execute(select(User).where(User.id == prt.user_id))).scalar_one()
    user.password_hash = hash_password(body.new_password)

    # invalidate any other unconsumed tokens for the user
    await session.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id)
        .where(PasswordResetToken.consumed_at.is_(None))
        .values(consumed_at=datetime.now(timezone.utc))
    )

    org_id = await _first_org_id(session, user.id)
    if org_id:
        await record_audit(
            session,
            org_id=org_id,
            user_id=user.id,
            action="auth.password_reset_consumed",
            entity_type="user",
            entity_id=user.id,
        )
        _safe_publish(org_id, "auth.password_reset_consumed", {"user_id": user.id})

    return ResetPasswordResponse(ok=True)


@router.post("/accept-invite", response_model=SessionDTO)
async def accept_invite(
    body: AcceptInviteRequest,
    session: AsyncSession = Depends(get_async_session),
):
    inv = await consume_invitation_token(session, body.token)
    if inv is None or inv.email.lower() != body.email.lower():
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_token", "message": "Token invalid, expired, or email mismatch"},
        )

    user = (await session.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if user is None:
        if not body.password or len(body.password) < 8:
            raise HTTPException(status_code=400, detail={"code": "password_required"})
        user = User(id=gen_uuid(), email=body.email, password_hash=hash_password(body.password))
        session.add(user)
        await session.flush()

    # avoid duplicate membership
    existing = (await session.execute(
        select(Membership).where(Membership.user_id == user.id).where(Membership.org_id == inv.org_id)
    )).scalar_one_or_none()
    if existing is None:
        session.add(Membership(id=gen_uuid(), user_id=user.id, org_id=inv.org_id, role=inv.role))
        await session.flush()

    await record_audit(
        session,
        org_id=inv.org_id,
        user_id=user.id,
        action="invitation.accepted",
        entity_type="invitation",
        entity_id=inv.id,
        details={"role": inv.role},
    )
    _safe_publish(inv.org_id, "invitation.accepted", {"invitation_id": inv.id, "user_id": user.id})

    access_token = create_access_token(user.id)
    return SessionDTO(access_token=access_token, user=UserDTO.model_validate(user))


async def _first_org_id(session: AsyncSession, user_id: str) -> str | None:
    res = await session.execute(
        select(Membership.org_id).where(Membership.user_id == user_id)
        .order_by(Membership.created_at.asc()).limit(1)
    )
    val = res.scalar_one_or_none()
    return val
