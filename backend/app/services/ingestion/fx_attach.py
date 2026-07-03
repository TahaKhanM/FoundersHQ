"""Ingest-time FX rate attachment.

Wraps :func:`app.services.fx.rates.get_rate` so the CSV ingest path can
fail soft: if no rate row exists, the column is persisted as NULL and a
warning is logged. Same-currency rows return None (no FX was applied).

Why this exists: at ingest time we want the rate used to be captured on
the row forever (historical reproducibility — see
``deterministic-finance`` skill). Re-running a forecast next month against
the same DB must produce the same base-currency value.

Two flavours:
- :func:`lookup_fx_rate_used` — async; consumed from FastAPI routes.
- :func:`lookup_fx_rate_used_sync` — sync; consumed from Celery workers
  which run on a synchronous SQLAlchemy session.
"""
from __future__ import annotations

import logging
from datetime import date as date_cls
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.fx_rate import FxRate
from app.services.fx.rates import FxRateMissing, get_rate

log = logging.getLogger(__name__)


async def lookup_fx_rate_used(
    session: AsyncSession,
    *,
    base_currency: str,
    source_currency: str,
    on_date: date_cls,
) -> Decimal | None:
    """Return the FX rate to persist in ``fx_rate_used`` for an ingested row.

    - ``source_currency == base_currency``: return ``None`` (no FX applied).
    - Cross-currency with a known rate: return that rate.
    - Cross-currency with no rate: log a warning and return ``None``. The
      ingest job still imports the row so the user isn't blocked.
    """
    if source_currency == base_currency:
        return None
    try:
        return await get_rate(
            session,
            on_date=on_date,
            source=source_currency,
            target=base_currency,
        )
    except FxRateMissing:
        log.warning(
            "fx_rate_missing pair=%s->%s date=%s",
            source_currency,
            base_currency,
            on_date.isoformat(),
        )
        return None


def lookup_fx_rate_used_sync(
    session: Session,
    *,
    base_currency: str,
    source_currency: str,
    on_date: date_cls,
) -> Decimal | None:
    """Synchronous variant for Celery workers.

    Mirrors :func:`lookup_fx_rate_used` exactly; the duplication is the
    price of running ingest in a worker that uses a sync session.
    """
    if source_currency == base_currency:
        return None
    row = (
        session.execute(
            select(FxRate)
            .where(
                FxRate.source_currency == source_currency,
                FxRate.target_currency == base_currency,
                FxRate.date <= on_date,
            )
            .order_by(FxRate.date.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if row is None:
        log.warning(
            "fx_rate_missing pair=%s->%s date=%s",
            source_currency,
            base_currency,
            on_date.isoformat(),
        )
        return None
    return Decimal(row.rate)
