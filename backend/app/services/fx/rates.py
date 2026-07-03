"""FX rate lookup with deterministic fallback.

The single entry point is :func:`get_rate`. Resolution order:

1. Exact match on ``(date == on_date, source, target)``.
2. The most recent row with ``date <= on_date`` for the same pair.
3. If ``source == target``, return ``Decimal("1")`` without DB access.
4. Otherwise raise :class:`FxRateMissing`.

This module is the single source of truth for "what rate did we use?".
Callers persist the returned ``Decimal`` on the row (``fx_rate_used``) so
future re-runs reproduce the same converted value.
"""
from __future__ import annotations

from datetime import date as date_cls
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fx_rate import FxRate


class FxRateMissing(LookupError):
    """Raised when no rate row is available on or before the requested date.

    Callers may either fail the operation, fall back to a sentinel value
    (e.g. persisting ``fx_rate_used=NULL`` and emitting a warning), or
    short-circuit when ``source == target``.
    """

    def __init__(self, *, on_date: date_cls, source: str, target: str) -> None:
        self.on_date = on_date
        self.source = source
        self.target = target
        super().__init__(
            f"No FX rate for {source!r} -> {target!r} on or before {on_date.isoformat()}"
        )


async def get_rate(
    session: AsyncSession,
    *,
    on_date: date_cls,
    source: str,
    target: str,
) -> Decimal:
    """Return the FX rate to convert ``source`` into ``target`` on ``on_date``.

    Falls back to the most recent row with ``date <= on_date`` for the pair.
    Returns ``Decimal("1")`` when ``source == target`` without consulting the DB.
    """
    if source == target:
        return Decimal("1")

    row = (
        await session.execute(
            select(FxRate)
            .where(
                FxRate.source_currency == source,
                FxRate.target_currency == target,
                FxRate.date <= on_date,
            )
            .order_by(FxRate.date.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if row is None:
        raise FxRateMissing(on_date=on_date, source=source, target=target)
    return Decimal(row.rate)
