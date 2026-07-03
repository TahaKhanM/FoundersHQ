"""High-level ``convert_amount`` helper.

A thin wrapper around :func:`app.services.fx.rates.get_rate` that
multiplies through a rate and rounds via :func:`app.utils.money.round_currency`.
Deterministic: ``on_date`` is always a parameter, never read from a clock.
"""
from __future__ import annotations

from datetime import date as date_cls
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.fx.rates import get_rate
from app.utils.money import round_currency


async def convert_amount(
    amount: Decimal,
    source_currency: str,
    target_currency: str,
    on_date: date_cls,
    session: AsyncSession,
) -> Decimal:
    """Convert ``amount`` from ``source_currency`` to ``target_currency``.

    Same-currency short-circuit returns ``amount`` unchanged (preserving
    Decimal precision rather than re-rounding). Cross-currency converts
    multiply by the historical rate and round to currency precision.

    Raises :class:`app.services.fx.rates.FxRateMissing` when no usable rate
    exists on or before ``on_date``.
    """
    if source_currency == target_currency:
        return amount

    rate = await get_rate(
        session, on_date=on_date, source=source_currency, target=target_currency
    )
    return round_currency(amount * rate)
