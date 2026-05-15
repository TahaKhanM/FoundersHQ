"""Unit tests for FX rate model + rate lookup with fallback.

Phase 2.C task 1 (model + migration) + task 2 (get_rate fallback).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select

# ---------------------------------------------------------------------------
# Task 1 — model + round-trip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fx_rate_round_trip(async_session):
    """Insert a row and read it back; columns preserve types."""
    from app.models.fx_rate import FxRate

    row = FxRate(
        date=date(2026, 1, 1),
        source_currency="EUR",
        target_currency="USD",
        rate=Decimal("1.05"),
    )
    async_session.add(row)
    await async_session.flush()

    fetched = (
        await async_session.execute(
            select(FxRate).where(
                FxRate.date == date(2026, 1, 1),
                FxRate.source_currency == "EUR",
                FxRate.target_currency == "USD",
            )
        )
    ).scalar_one()
    assert fetched.rate == Decimal("1.05")
    assert fetched.source_currency == "EUR"
    assert fetched.target_currency == "USD"
    assert fetched.date == date(2026, 1, 1)


@pytest.mark.asyncio
async def test_fx_rate_unique_per_day_pair(async_session):
    """Composite uniqueness on (date, source, target) prevents duplicates."""
    from sqlalchemy.exc import IntegrityError

    from app.models.fx_rate import FxRate

    async_session.add(
        FxRate(
            date=date(2026, 1, 2),
            source_currency="EUR",
            target_currency="USD",
            rate=Decimal("1.06"),
        )
    )
    await async_session.flush()
    async_session.add(
        FxRate(
            date=date(2026, 1, 2),
            source_currency="EUR",
            target_currency="USD",
            rate=Decimal("1.07"),
        )
    )
    with pytest.raises(IntegrityError):
        await async_session.flush()


# ---------------------------------------------------------------------------
# Task 2 — get_rate fallback semantics
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_rate_exact_match(async_session):
    from app.models.fx_rate import FxRate
    from app.services.fx.rates import get_rate

    async_session.add(
        FxRate(
            date=date(2026, 3, 1),
            source_currency="EUR",
            target_currency="USD",
            rate=Decimal("1.10"),
        )
    )
    await async_session.flush()

    rate = await get_rate(
        async_session, on_date=date(2026, 3, 1), source="EUR", target="USD"
    )
    assert rate == Decimal("1.10")


@pytest.mark.asyncio
async def test_get_rate_falls_back_to_most_recent_prior(async_session):
    from app.models.fx_rate import FxRate
    from app.services.fx.rates import get_rate

    # Two rows; query for a date in between → should return the earlier one.
    async_session.add_all(
        [
            FxRate(
                date=date(2026, 3, 1),
                source_currency="EUR",
                target_currency="USD",
                rate=Decimal("1.10"),
            ),
            FxRate(
                date=date(2026, 3, 5),
                source_currency="EUR",
                target_currency="USD",
                rate=Decimal("1.12"),
            ),
        ]
    )
    await async_session.flush()

    rate = await get_rate(
        async_session, on_date=date(2026, 3, 3), source="EUR", target="USD"
    )
    assert rate == Decimal("1.10")


@pytest.mark.asyncio
async def test_get_rate_same_currency_short_circuit(async_session):
    """When source == target, return 1 without consulting the DB."""
    from app.services.fx.rates import get_rate

    rate = await get_rate(
        async_session, on_date=date(2026, 1, 1), source="USD", target="USD"
    )
    assert rate == Decimal("1")


@pytest.mark.asyncio
async def test_get_rate_missing_raises(async_session):
    from app.services.fx.rates import FxRateMissing, get_rate

    with pytest.raises(FxRateMissing):
        await get_rate(
            async_session, on_date=date(2026, 1, 1), source="JPY", target="USD"
        )


@pytest.mark.asyncio
async def test_get_rate_ignores_future_rows(async_session):
    """Rows dated after `on_date` must not be used; only on-or-before."""
    from app.models.fx_rate import FxRate
    from app.services.fx.rates import FxRateMissing, get_rate

    async_session.add(
        FxRate(
            date=date(2026, 4, 10),
            source_currency="EUR",
            target_currency="USD",
            rate=Decimal("1.20"),
        )
    )
    await async_session.flush()

    with pytest.raises(FxRateMissing):
        await get_rate(
            async_session, on_date=date(2026, 4, 1), source="EUR", target="USD"
        )
