"""Org-scope dev invariant: flushing an org-scoped row without org_id raises."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.models.transaction import Transaction
from app.utils.org_scope import OrgScopeViolation


@pytest.mark.asyncio
async def test_inserting_org_scoped_row_without_org_id_raises(async_session) -> None:
    t = Transaction(
        org_id=None,
        txn_date=date(2026, 1, 1),
        merchant_canonical="x",
        amount=Decimal("1.00"),
        currency="USD",
        source="csv",
    )
    async_session.add(t)
    with pytest.raises(OrgScopeViolation):
        await async_session.flush()


@pytest.mark.asyncio
async def test_inserting_org_scoped_row_with_org_id_does_not_raise(
    async_session, seeded_org
) -> None:
    t = Transaction(
        org_id=seeded_org.id,
        txn_date=date(2026, 1, 1),
        merchant_canonical="x",
        amount=Decimal("1.00"),
        currency="USD",
        source="csv",
    )
    async_session.add(t)
    await async_session.flush()  # must not raise
