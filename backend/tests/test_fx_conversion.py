"""Unit tests for the convert_amount helper.

Covers: cross-currency math, rounding, same-currency short-circuit,
fallback-rate use, round-trip stability (USD -> EUR -> USD within rounding
tolerance), and missing-rate behaviour.

Phase 2.C task 3.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.models.fx_rate import FxRate
from app.services.fx.conversion import convert_amount
from app.services.fx.rates import FxRateMissing


@pytest.mark.asyncio
async def test_convert_amount_same_currency_passthrough(async_session):
    """Same-currency short-circuit returns the amount unchanged."""
    result = await convert_amount(
        Decimal("123.45"), "USD", "USD", date(2026, 1, 1), async_session
    )
    assert result == Decimal("123.45")


@pytest.mark.asyncio
async def test_convert_amount_cross_currency(async_session):
    """EUR 100 at rate 1.10 -> USD 110.00, rounded to 2 decimals."""
    async_session.add(
        FxRate(
            date=date(2026, 1, 1),
            source_currency="EUR",
            target_currency="USD",
            rate=Decimal("1.10"),
        )
    )
    await async_session.flush()

    result = await convert_amount(
        Decimal("100"), "EUR", "USD", date(2026, 1, 1), async_session
    )
    assert result == Decimal("110.00")


@pytest.mark.asyncio
async def test_convert_amount_uses_fallback_rate(async_session):
    """If no exact-date row exists, the helper falls back to the most recent."""
    async_session.add(
        FxRate(
            date=date(2026, 1, 1),
            source_currency="GBP",
            target_currency="USD",
            rate=Decimal("1.25"),
        )
    )
    await async_session.flush()

    result = await convert_amount(
        Decimal("100"), "GBP", "USD", date(2026, 1, 15), async_session
    )
    assert result == Decimal("125.00")


@pytest.mark.asyncio
async def test_convert_amount_rounds_to_currency_precision(async_session):
    """Rounding is currency-precision (2 dp); half-up via round_currency."""
    async_session.add(
        FxRate(
            date=date(2026, 1, 1),
            source_currency="EUR",
            target_currency="USD",
            rate=Decimal("1.0567"),
        )
    )
    await async_session.flush()

    # 33.33 * 1.0567 = 35.219811 -> 35.22 (half-up)
    result = await convert_amount(
        Decimal("33.33"), "EUR", "USD", date(2026, 1, 1), async_session
    )
    assert result == Decimal("35.22")


@pytest.mark.asyncio
async def test_convert_amount_round_trip_stable_within_epsilon(async_session):
    """USD -> EUR -> USD recovers the original within 1c rounding loss.

    Reconciliation-style test: even with double conversion, the result
    stays within Decimal('0.02') of the input.
    """
    # EUR/USD: 1 EUR = 1.10 USD => 1 USD = 1/1.10 EUR.
    # We provide both directions explicitly to keep the rate facts deterministic.
    async_session.add_all(
        [
            FxRate(
                date=date(2026, 1, 1),
                source_currency="USD",
                target_currency="EUR",
                rate=Decimal("0.9091"),
            ),
            FxRate(
                date=date(2026, 1, 1),
                source_currency="EUR",
                target_currency="USD",
                rate=Decimal("1.10"),
            ),
        ]
    )
    await async_session.flush()

    eur = await convert_amount(
        Decimal("100"), "USD", "EUR", date(2026, 1, 1), async_session
    )
    back = await convert_amount(eur, "EUR", "USD", date(2026, 1, 1), async_session)
    # 100 -> 90.91 -> 100.00 (rate product == 0.9091 * 1.10 == 1.00001).
    assert abs(back - Decimal("100")) <= Decimal("0.02")


@pytest.mark.asyncio
async def test_convert_amount_raises_on_missing_rate(async_session):
    """No usable rate row anywhere -> FxRateMissing bubbles up."""
    with pytest.raises(FxRateMissing):
        await convert_amount(
            Decimal("100"), "JPY", "USD", date(2026, 1, 1), async_session
        )


@pytest.mark.asyncio
async def test_convert_amount_preserves_decimal_for_same_currency(async_session):
    """No rounding when source==target: preserve precision of caller's Decimal."""
    result = await convert_amount(
        Decimal("100.123456"), "USD", "USD", date(2026, 1, 1), async_session
    )
    # Important: same-currency does NOT re-round; trailing digits survive.
    assert result == Decimal("100.123456")
