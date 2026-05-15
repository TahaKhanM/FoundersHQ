"""Magic-link / password-reset token helpers.

Generation returns ``(raw, sha256_hex)``. Only the hex is ever persisted; the raw
value is shown once (returned in the API response in non-prod envs, or — once
SMTP lands in phase 5 — emailed to the user).
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invitation import Invitation
from app.models.password_reset import PasswordResetToken


def generate_token() -> tuple[str, str]:
    """Return ``(raw_token, sha256_hex)``. Caller stores the hash; sends the raw."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    """sha256 hex of the raw token. Deterministic; safe to compare."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _aware(dt: datetime) -> datetime:
    """Treat naive datetimes (some DBs strip tz) as UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


async def verify_invitation_token(session: AsyncSession, raw: str, *, now: datetime | None = None) -> Invitation | None:
    """Return the invitation if the token resolves to a still-valid row, else None.

    Validity = not accepted, not revoked, not expired.
    """
    now = now or _utcnow()
    result = await session.execute(
        select(Invitation).where(Invitation.token_hash == hash_token(raw)).limit(1)
    )
    inv = result.scalar_one_or_none()
    if inv is None:
        return None
    if inv.accepted_at is not None or inv.revoked_at is not None:
        return None
    if _aware(inv.expires_at) <= now:
        return None
    return inv


async def consume_invitation_token(session: AsyncSession, raw: str, *, now: datetime | None = None) -> Invitation | None:
    """Verify + mark accepted in a single atomic step. Returns the invitation or None."""
    now = now or _utcnow()
    inv = await verify_invitation_token(session, raw, now=now)
    if inv is None:
        return None
    inv.accepted_at = now
    await session.flush()
    return inv


async def verify_reset_token(session: AsyncSession, raw: str, *, now: datetime | None = None) -> PasswordResetToken | None:
    """Return the reset token if still valid (not consumed, not expired)."""
    now = now or _utcnow()
    result = await session.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(raw)).limit(1)
    )
    prt = result.scalar_one_or_none()
    if prt is None:
        return None
    if prt.consumed_at is not None:
        return None
    if _aware(prt.expires_at) <= now:
        return None
    return prt


async def consume_reset_token(session: AsyncSession, raw: str, *, now: datetime | None = None) -> PasswordResetToken | None:
    """Verify + mark consumed atomically."""
    now = now or _utcnow()
    prt = await verify_reset_token(session, raw, now=now)
    if prt is None:
        return None
    prt.consumed_at = now
    await session.flush()
    return prt
