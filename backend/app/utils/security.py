"""JWT and security helpers."""
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt

from app.config import get_settings


def create_access_token(sub: str | UUID) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(sub), "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
