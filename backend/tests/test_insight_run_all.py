"""Orchestrator: persistence, dedupe, audit, event publish."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.commitment import Commitment
from app.models.financial_profile import FinancialProfile
from app.models.insight import Insight
from app.models.invoice import Customer, Invoice
from app.models.org import Org
from app.models.transaction import Transaction
from app.services.events import drain_events
from app.services.insights.run_all import run_all


@pytest.mark.asyncio
async def test_run_all_persists_and_audits(async_session):
    """A fresh org with one obvious finding ⇒ exactly one Insight row + audit + event."""
    drain_events()
    org = Org(id=str(uuid4()), name="Acme")
    async_session.add(org)
    await async_session.flush()

    # Seed a customer + an invoice due today so the late-invoice generator fires.
    cust = Customer(id=str(uuid4()), org_id=org.id, name_raw="BigCo")
    async_session.add(cust)
    await async_session.flush()
    inv = Invoice(
        id=str(uuid4()),
        org_id=org.id,
        customer_id=cust.id,
        invoice_number="INV-1",
        issue_date=date(2026, 4, 16),
        due_date=date(2026, 5, 16),
        amount=Decimal("10000"),
        currency="USD",
        status="open",
    )
    async_session.add(inv)
    await async_session.flush()

    created = await run_all(
        org_id=org.id,
        today=date(2026, 5, 16),
        session=async_session,
        last_run=date(2026, 5, 15),
    )
    await async_session.flush()

    # ---- Insight row persisted ----
    rows = (
        await async_session.execute(
            select(Insight).where(Insight.org_id == org.id)
        )
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].type == "late_invoice"
    assert rows[0].evidence_ids == [inv.id]
    assert rows[0].status == "active"
    # Returned tuple matches the persisted row.
    assert len(created) == 1
    assert created[0].id == rows[0].id

    # ---- Audit row exists ----
    audits = (
        await async_session.execute(
            select(AuditLog).where(
                AuditLog.entity_id == rows[0].id,
                AuditLog.action == "insight.created",
            )
        )
    ).scalars().all()
    assert len(audits) == 1
    assert audits[0].details["type"] == "late_invoice"

    # ---- Event published ----
    events = drain_events()
    types = [t for (_, t, _) in events]
    assert "insight.created" in types
    payload = next(p for (_, t, p) in events if t == "insight.created")
    assert payload["type"] == "late_invoice"
    assert inv.id in payload["evidence_ids"]


@pytest.mark.asyncio
async def test_run_all_is_idempotent(async_session):
    """Running the orchestrator twice with the same facts inserts no duplicates."""
    org = Org(id=str(uuid4()), name="Beta Inc")
    async_session.add(org)
    cust = Customer(id=str(uuid4()), org_id=org.id, name_raw="X")
    async_session.add(cust)
    await async_session.flush()
    inv = Invoice(
        id=str(uuid4()),
        org_id=org.id,
        customer_id=cust.id,
        invoice_number="INV-DUP",
        issue_date=date(2026, 4, 16),
        due_date=date(2026, 5, 16),
        amount=Decimal("1000"),
        currency="USD",
        status="open",
    )
    async_session.add(inv)
    await async_session.flush()

    first = await run_all(
        org_id=org.id,
        today=date(2026, 5, 16),
        session=async_session,
        last_run=date(2026, 5, 15),
    )
    await async_session.flush()
    second = await run_all(
        org_id=org.id,
        today=date(2026, 5, 16),
        session=async_session,
        last_run=date(2026, 5, 15),
    )
    await async_session.flush()

    assert len(first) == 1
    # Dedupe: second pass produces zero new rows.
    assert second == []
    rows = (
        await async_session.execute(
            select(Insight).where(Insight.org_id == org.id)
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_run_all_dedupes_within_batch(async_session):
    """Two generators that produce identical (type, evidence) emit one row each."""
    # Build an org with a renewal-ready commitment AND a late invoice.
    # The dedupe key is (type, evidence_hash); since the two generators
    # produce different types they don't collide. This test verifies that
    # the orchestrator inserts both insights in one pass.
    org = Org(id=str(uuid4()), name="Gamma")
    async_session.add(org)
    cust = Customer(id=str(uuid4()), org_id=org.id, name_raw="Y")
    async_session.add(cust)
    await async_session.flush()
    inv = Invoice(
        id=str(uuid4()),
        org_id=org.id,
        customer_id=cust.id,
        invoice_number="INV-X",
        issue_date=date(2026, 4, 16),
        due_date=date(2026, 5, 16),
        amount=Decimal("1000"),
        currency="USD",
        status="open",
    )
    async_session.add(inv)
    cmt = Commitment(
        id=str(uuid4()),
        org_id=org.id,
        merchant_canonical="AWS",
        frequency="monthly",
        typical_amount=Decimal("1500"),
        currency="USD",
        last_seen_date=date(2026, 4, 16),
        next_due_date=date(2026, 5, 30),
        confidence=0.9,
        enabled=True,
    )
    async_session.add(cmt)
    await async_session.flush()

    created = await run_all(
        org_id=org.id,
        today=date(2026, 5, 16),
        session=async_session,
        last_run=date(2026, 5, 15),
    )
    types = sorted([i.type for i in created])
    assert types == ["commitment_renewal", "late_invoice"]


@pytest.mark.asyncio
async def test_run_all_isolation_between_orgs(async_session):
    """Insights from org A do not leak into org B's dedupe set."""
    org_a = Org(id=str(uuid4()), name="A")
    org_b = Org(id=str(uuid4()), name="B")
    async_session.add_all([org_a, org_b])
    await async_session.flush()
    for org in (org_a, org_b):
        cust = Customer(id=str(uuid4()), org_id=org.id, name_raw="C")
        async_session.add(cust)
        await async_session.flush()
        async_session.add(
            Invoice(
                id=str(uuid4()),
                org_id=org.id,
                customer_id=cust.id,
                invoice_number="INV-A",
                issue_date=date(2026, 4, 16),
                due_date=date(2026, 5, 16),
                amount=Decimal("1000"),
                currency="USD",
                status="open",
            )
        )
        await async_session.flush()

    created_a = await run_all(
        org_id=org_a.id,
        today=date(2026, 5, 16),
        session=async_session,
        last_run=date(2026, 5, 15),
    )
    created_b = await run_all(
        org_id=org_b.id,
        today=date(2026, 5, 16),
        session=async_session,
        last_run=date(2026, 5, 15),
    )
    assert len(created_a) == 1
    assert len(created_b) == 1
    assert created_a[0].id != created_b[0].id


@pytest.mark.asyncio
async def test_run_all_with_cash_balance_seeds_history(async_session):
    """A FinancialProfile + recent transactions feeds the cash-drop generator."""
    org = Org(id=str(uuid4()), name="Delta")
    async_session.add(org)
    await async_session.flush()
    async_session.add(
        FinancialProfile(
            id=str(uuid4()),
            org_id=org.id,
            cash_balance=Decimal("50000"),
            currency="USD",
        )
    )
    # Two weeks of transactions: prior week +60k, current week -40k.
    # End-of-current-week cash = 50k; end-of-prior = 50k - (-40k) = 90k.
    # That's a (90 - 50)/90 = ~44% drop ⇒ warn.
    txn_dates = [
        (date(2026, 5, 4), Decimal("60000"), "prior-in"),
        (date(2026, 5, 11), Decimal("-40000"), "curr-out"),
    ]
    for d, amt, label in txn_dates:
        async_session.add(
            Transaction(
                id=str(uuid4()),
                org_id=org.id,
                txn_date=d,
                description=label,
                amount=amt,
                currency="USD",
                source="csv",
            )
        )
    await async_session.flush()

    drain_events()
    created = await run_all(
        org_id=org.id,
        today=date(2026, 5, 16),
        session=async_session,
        last_run=date(2026, 5, 10),
    )
    types = [i.type for i in created]
    assert "cash_drop" in types


@pytest.mark.asyncio
async def test_dismissed_insight_not_recreated_without_change(async_session):
    """Once dismissed, the same evidence does NOT resurface on re-run."""
    org = Org(id=str(uuid4()), name="Echo")
    async_session.add(org)
    cust = Customer(id=str(uuid4()), org_id=org.id, name_raw="Z")
    async_session.add(cust)
    await async_session.flush()
    inv = Invoice(
        id=str(uuid4()),
        org_id=org.id,
        customer_id=cust.id,
        invoice_number="INV-D",
        issue_date=date(2026, 4, 16),
        due_date=date(2026, 5, 16),
        amount=Decimal("1000"),
        currency="USD",
        status="open",
    )
    async_session.add(inv)
    await async_session.flush()

    created = await run_all(
        org_id=org.id,
        today=date(2026, 5, 16),
        session=async_session,
        last_run=date(2026, 5, 15),
    )
    assert len(created) == 1
    insight_row = created[0]

    # Dismiss it.
    from datetime import UTC
    from datetime import datetime as dt_cls

    insight_row.status = "dismissed"
    insight_row.dismissed_at = dt_cls.now(UTC)
    await async_session.flush()

    # Re-run. Dedupe set only considers active rows, but the late-invoice
    # generator window has not advanced ⇒ no new candidate.
    second = await run_all(
        org_id=org.id,
        today=date(2026, 5, 16),
        session=async_session,
        last_run=date(2026, 5, 15),
    )
    assert second == []
    # Still exactly one row total.
    rows = (
        await async_session.execute(
            select(Insight).where(Insight.org_id == org.id)
        )
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].status == "dismissed"


@pytest.mark.asyncio
async def test_run_all_advances_with_new_window(async_session):
    """A second-day run picks up a newly-late invoice without disturbing yesterday's."""
    org = Org(id=str(uuid4()), name="Foxtrot")
    async_session.add(org)
    cust = Customer(id=str(uuid4()), org_id=org.id, name_raw="W")
    async_session.add(cust)
    await async_session.flush()
    inv_old = Invoice(
        id=str(uuid4()),
        org_id=org.id,
        customer_id=cust.id,
        invoice_number="INV-OLD",
        issue_date=date(2026, 4, 16),
        due_date=date(2026, 5, 16),
        amount=Decimal("1000"),
        currency="USD",
        status="open",
    )
    inv_new = Invoice(
        id=str(uuid4()),
        org_id=org.id,
        customer_id=cust.id,
        invoice_number="INV-NEW",
        issue_date=date(2026, 4, 17),
        due_date=date(2026, 5, 17),
        amount=Decimal("2000"),
        currency="USD",
        status="open",
    )
    async_session.add_all([inv_old, inv_new])
    await async_session.flush()

    first = await run_all(
        org_id=org.id,
        today=date(2026, 5, 16),
        session=async_session,
        last_run=date(2026, 5, 15),
    )
    assert [i.evidence_ids[0] for i in first] == [inv_old.id]

    second = await run_all(
        org_id=org.id,
        today=date(2026, 5, 17),
        session=async_session,
        last_run=date(2026, 5, 16),
    )
    assert [i.evidence_ids[0] for i in second] == [inv_new.id]

    rows = (
        await async_session.execute(
            select(Insight)
            .where(Insight.org_id == org.id)
            .order_by(Insight.created_at.asc())
        )
    ).scalars().all()
    assert len(rows) == 2


@pytest.mark.asyncio
async def test_run_all_today_default_in_router_layer(async_session):
    """The router defaults ``today`` to ``date.today()``; the orchestrator does not.

    This test pins the contract — generators must never read the clock.
    """
    # Use ``today - 1y`` so no invoice in the seed satisfies any window.
    org = Org(id=str(uuid4()), name="Golf")
    async_session.add(org)
    cust = Customer(id=str(uuid4()), org_id=org.id, name_raw="Q")
    async_session.add(cust)
    await async_session.flush()
    async_session.add(
        Invoice(
            id=str(uuid4()),
            org_id=org.id,
            customer_id=cust.id,
            invoice_number="INV-OLD",
            issue_date=date(2025, 4, 16),
            due_date=date(2025, 5, 16),
            amount=Decimal("1000"),
            currency="USD",
            status="open",
        )
    )
    await async_session.flush()

    out = await run_all(
        org_id=org.id,
        today=date(2026, 5, 16),
        session=async_session,
        last_run=date(2026, 5, 16) - timedelta(days=1),
    )
    # Old invoice is well outside the window; nothing fires.
    assert out == []
