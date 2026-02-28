"""Idempotent FX rate bulk-upsert.

The ``/fx/rates`` admin endpoint calls into here; tests also call it
directly. Idempotent: re-running with the same rows is a no-op.
Re-running with a different ``rate`` on the same ``(date, source, target)``
overwrites — this is intentional so a corrected feed can replace a bad
snapshot. Every overwrite is logged via the audit row written by the router.
"""
from __future__ import annotations

from datetime import date as date_cls
from decimal import Decimal
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import gen_uuid
from app.models.fx_rate import FxRate


class FxRateRow(TypedDict):
    """Shape of one row passed to :func:`upsert_rates`.

    ``rate`` is a ``Decimal`` to keep the call site honest — the router
    coerces request payloads up front.
    """

    date: date_cls
    source_currency: str
    target_currency: str
    rate: Decimal


class UpsertResult(TypedDict):
    inserted: int
    updated: int


async def upsert_rates(session: AsyncSession, rows: list[FxRateRow]) -> UpsertResult:
    """Insert-or-update each row by ``(date, source_currency, target_currency)``.

    Returns counts for the caller to surface to the user. Does not commit;
    the FastAPI session dependency handles transaction boundaries.
    """
    inserted = 0
    updated = 0
    for row in rows:
        existing = (
            await session.execute(
                select(FxRate).where(
                    FxRate.date == row["date"],
                    FxRate.source_currency == row["source_currency"],
                    FxRate.target_currency == row["target_currency"],
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            session.add(
                FxRate(
                    id=gen_uuid(),
                    date=row["date"],
                    source_currency=row["source_currency"],
                    target_currency=row["target_currency"],
                    rate=row["rate"],
                )
            )
            inserted += 1
        else:
            if existing.rate != row["rate"]:
                existing.rate = row["rate"]
                updated += 1
    await session.flush()
    return {"inserted": inserted, "updated": updated}
