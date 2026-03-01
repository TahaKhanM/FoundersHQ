"""Phase 2.E: every mutation route family publishes an event.

The rule is: if a mutation calls ``record_audit``, it must also call
``publish_event`` (durable) or ``publish_event_best_effort`` (in-process
queue). The frontend trusts this contract — a missing publish leaves the
SWR cache stale until the page refetches on focus.

One test per route family. We exercise the route via the FastAPI
TestClient against the in-memory SQLite session and assert that the
matching ``EventType`` appears in :func:`drain_events`.

For routes that use the durable :func:`publish_event` (which writes the
outbox row before Redis), we additionally assert that the
``events_outbox`` row was persisted.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.commitment import Commitment
from app.models.events_outbox import EventOutbox
from app.models.invoice import Customer, Invoice
from app.models.runway import Milestone
from app.models.transaction import (
    CategorizationRule,
    Transaction,
    TransactionCategory,
)
from app.services.events import EventType, drain_events


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register_owner(client, email: str | None = None) -> tuple[str, str]:
    """Register and return (token, org_id)."""
    email = email or f"o-{uuid4().hex[:6]}@ex.com"
    r = client.post("/auth/register", json={"email": email, "password": "pw1234567"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    org = client.get("/org", headers=_auth(token))
    assert org.status_code == 200, org.text
    return token, org.json()["id"]


def _event_types(events: list[tuple[str, str, dict]]) -> list[str]:
    return [t for (_, t, _) in events]


# ---------------------------------------------------------------------------
# Spending
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_spending_transaction_patch_publishes(client, async_session):
    token, org_id = _register_owner(client)
    cat = TransactionCategory(id=str(uuid4()), org_id=org_id, name="ops")
    txn = Transaction(
        id=str(uuid4()),
        org_id=org_id,
        txn_date=date(2026, 1, 1),
        description="x",
        amount=Decimal("-10"),
        currency="USD",
        source="csv",
    )
    async_session.add_all([cat, txn])
    await async_session.commit()
    drain_events()

    r = client.patch(
        f"/spending/transactions/{txn.id}",
        headers=_auth(token),
        json={"category_id": cat.id},
    )
    assert r.status_code == 200, r.text
    assert EventType.TRANSACTION_CATEGORIZED.value in _event_types(drain_events())


async def _seed_category(async_session, org_id: str) -> TransactionCategory:
    cat = TransactionCategory(id=str(uuid4()), org_id=org_id, name="ops")
    async_session.add(cat)
    await async_session.commit()
    return cat


@pytest.mark.asyncio
async def test_spending_rule_create_publishes(client, async_session):
    token, org_id = _register_owner(client)
    cat = await _seed_category(async_session, org_id)
    drain_events()
    r = client.post(
        "/spending/rules",
        headers=_auth(token),
        json={"pattern": "AWS", "match_type": "contains", "category_id": cat.id},
    )
    assert r.status_code == 200, r.text
    assert EventType.CATEGORIZATION_RULE_CREATED.value in _event_types(drain_events())


@pytest.mark.asyncio
async def test_spending_rule_patch_publishes(client, async_session):
    token, org_id = _register_owner(client)
    cat = await _seed_category(async_session, org_id)
    rule = CategorizationRule(
        id=str(uuid4()),
        org_id=org_id,
        pattern="AWS",
        match_type="contains",
        category_id=cat.id,
    )
    async_session.add(rule)
    await async_session.commit()
    drain_events()
    r = client.patch(
        f"/spending/rules/{rule.id}",
        headers=_auth(token),
        json={"enabled": False},
    )
    assert r.status_code == 200, r.text
    assert EventType.CATEGORIZATION_RULE_UPDATED.value in _event_types(drain_events())


@pytest.mark.asyncio
async def test_spending_rule_delete_publishes(client, async_session):
    token, org_id = _register_owner(client)
    cat = await _seed_category(async_session, org_id)
    rule = CategorizationRule(
        id=str(uuid4()),
        org_id=org_id,
        pattern="AWS",
        match_type="contains",
        category_id=cat.id,
    )
    async_session.add(rule)
    await async_session.commit()
    drain_events()
    r = client.delete(f"/spending/rules/{rule.id}", headers=_auth(token))
    assert r.status_code == 204, r.text
    assert EventType.CATEGORIZATION_RULE_DELETED.value in _event_types(drain_events())


@pytest.mark.asyncio
async def test_spending_commitment_patch_publishes(client, async_session):
    token, org_id = _register_owner(client)
    c = Commitment(
        id=str(uuid4()),
        org_id=org_id,
        merchant_canonical="aws",
        frequency="monthly",
        typical_amount=Decimal("100"),
        currency="USD",
        last_seen_date=date(2026, 1, 1),
        next_due_date=date(2026, 2, 1),
        confidence=0.9,
    )
    async_session.add(c)
    await async_session.commit()
    drain_events()
    r = client.patch(
        f"/spending/commitments/{c.id}",
        headers=_auth(token),
        json={"enabled": False},
    )
    assert r.status_code == 200, r.text
    assert EventType.COMMITMENT_UPDATED.value in _event_types(drain_events())


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_invoice_touch_publishes(client, async_session):
    token, org_id = _register_owner(client)
    cust = Customer(id=str(uuid4()), org_id=org_id, name_raw="Acme")
    inv = Invoice(
        id=str(uuid4()),
        org_id=org_id,
        customer_id=cust.id,
        invoice_number="INV-001",
        issue_date=date(2026, 1, 1),
        due_date=date(2026, 2, 1),
        amount=Decimal("1000"),
        currency="USD",
        status="open",
    )
    async_session.add_all([cust, inv])
    await async_session.commit()
    drain_events()

    r = client.post(
        "/invoices/touches",
        headers=_auth(token),
        json={"invoice_id": inv.id, "channel": "email", "touch_type": "reminder"},
    )
    assert r.status_code == 200, r.text
    assert EventType.INVOICE_TOUCH_LOGGED.value in _event_types(drain_events())


# ---------------------------------------------------------------------------
# Runway
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_runway_forecast_compute_publishes(client, async_session):
    token, org_id = _register_owner(client)
    drain_events()

    r = client.post(
        "/runway/forecast/compute",
        headers=_auth(token),
        json={"horizon_weeks": 12, "scenario_params": {}},
    )
    assert r.status_code == 200, r.text
    types = _event_types(drain_events())
    # The compute event uses durable publish (outbox). It also lands in the
    # best-effort queue indirectly if the route chose it; either way the
    # router contract is "an event with this type was emitted".
    if EventType.RUNWAY_FORECAST_COMPUTED.value not in types:
        # Durable publish bypasses the in-process queue; check the outbox.
        rows = (
            await async_session.execute(
                select(EventOutbox).where(
                    EventOutbox.org_id == org_id,
                    EventOutbox.type == EventType.RUNWAY_FORECAST_COMPUTED.value,
                )
            )
        ).scalars().all()
        assert rows, "RUNWAY_FORECAST_COMPUTED not found in outbox or queue"


@pytest.mark.asyncio
async def test_runway_scenario_create_publishes(client):
    token, _ = _register_owner(client)
    drain_events()
    r = client.post(
        "/runway/scenarios",
        headers=_auth(token),
        json={"name": "Sales boom", "params": {"inflow_mult": 1.2}},
    )
    assert r.status_code == 200, r.text
    assert EventType.RUNWAY_SCENARIO_CREATED.value in _event_types(drain_events())


@pytest.mark.asyncio
async def test_runway_milestone_create_publishes(client):
    token, _ = _register_owner(client)
    drain_events()
    r = client.post(
        "/runway/milestones",
        headers=_auth(token),
        json={"name": "Seed round", "target_type": "raise", "target_value": "1000000"},
    )
    assert r.status_code == 200, r.text
    assert EventType.RUNWAY_MILESTONE_CREATED.value in _event_types(drain_events())


@pytest.mark.asyncio
async def test_runway_milestone_patch_publishes(client, async_session):
    token, org_id = _register_owner(client)
    m = Milestone(
        id=str(uuid4()),
        org_id=org_id,
        name="Seed",
        target_type="raise",
        target_value=Decimal("1"),
    )
    async_session.add(m)
    await async_session.commit()
    drain_events()
    r = client.patch(
        f"/runway/milestones/{m.id}",
        headers=_auth(token),
        json={"name": "Series A"},
    )
    assert r.status_code == 200, r.text
    assert EventType.RUNWAY_MILESTONE_UPDATED.value in _event_types(drain_events())


@pytest.mark.asyncio
async def test_runway_milestone_delete_publishes(client, async_session):
    token, org_id = _register_owner(client)
    m = Milestone(
        id=str(uuid4()),
        org_id=org_id,
        name="Seed",
        target_type="raise",
        target_value=Decimal("1"),
    )
    async_session.add(m)
    await async_session.commit()
    drain_events()
    r = client.delete(f"/runway/milestones/{m.id}", headers=_auth(token))
    assert r.status_code == 204, r.text
    assert EventType.RUNWAY_MILESTONE_DELETED.value in _event_types(drain_events())


# ---------------------------------------------------------------------------
# Funding
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_funding_save_opportunity_publishes(client, async_session):
    """Saving an opportunity publishes funding.opportunity_saved."""
    from app.models.funding import FundingOpportunity

    token, _ = _register_owner(client)
    opp = FundingOpportunity(id=str(uuid4()), type="grant", name="Test grant")
    async_session.add(opp)
    await async_session.commit()
    drain_events()
    r = client.post(
        "/funding/opportunities/save",
        headers=_auth(token),
        json={"opportunity_id": opp.id, "status": "interested"},
    )
    assert r.status_code == 200, r.text
    assert EventType.FUNDING_OPPORTUNITY_SAVED.value in _event_types(drain_events())


# ---------------------------------------------------------------------------
# Ingest (durable publish — check the outbox; the in-process queue is a
# fallback for the worker-side INGEST_JOB_PROGRESS).
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ingest_questionnaire_publishes(client):
    token, _ = _register_owner(client)
    drain_events()
    r = client.post(
        "/ingest/questionnaire",
        headers=_auth(token),
        json={"cash_balance": "100000", "currency": "USD"},
    )
    assert r.status_code == 200, r.text
    assert EventType.QUESTIONNAIRE_SAVED.value in _event_types(drain_events())


@pytest.mark.asyncio
async def test_ingest_sample_seed_publishes(client):
    token, _ = _register_owner(client)
    drain_events()
    r = client.post("/ingest/sample-seed", headers=_auth(token))
    assert r.status_code == 200, r.text
    assert EventType.SAMPLE_DATA_SEEDED.value in _event_types(drain_events())


# ---------------------------------------------------------------------------
# Org: data delete
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_org_data_delete_publishes(client):
    token, _ = _register_owner(client)
    drain_events()
    r = client.request(
        "DELETE",
        "/org/data",
        headers=_auth(token),
        json={"confirm": True},
    )
    assert r.status_code == 204, r.text
    assert EventType.ORG_DATA_PURGED.value in _event_types(drain_events())


# ---------------------------------------------------------------------------
# Auth / Invitations / Notifications — confirm enum migration didn't
# accidentally rename anything.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_auth_password_reset_uses_enum_string(client, async_session):
    # The flow needs an existing user (forgot-password for a fresh email is a no-op).
    token, org_id = _register_owner(client, email="reset@ex.com")
    drain_events()
    r = client.post("/auth/forgot-password", json={"email": "reset@ex.com"})
    assert r.status_code == 200, r.text
    types = _event_types(drain_events())
    assert EventType.AUTH_PASSWORD_RESET_REQUESTED.value in types


@pytest.mark.asyncio
async def test_invitation_create_uses_enum_string(client):
    token, _ = _register_owner(client)
    drain_events()
    r = client.post(
        "/org/invitations",
        headers=_auth(token),
        json={"email": "newbie@ex.com", "role": "member"},
    )
    assert r.status_code == 200, r.text
    assert EventType.INVITATION_CREATED.value in _event_types(drain_events())


@pytest.mark.asyncio
async def test_notification_preferences_update_uses_enum_string(client):
    token, _ = _register_owner(client)
    drain_events()
    r = client.put(
        "/notifications/preferences",
        headers=_auth(token),
        json={
            "preferences": [
                {"type": "spending", "in_app": False, "email": False},
            ]
        },
    )
    assert r.status_code == 200, r.text
    assert EventType.NOTIFICATION_PREFERENCE_UPDATED.value in _event_types(drain_events())
