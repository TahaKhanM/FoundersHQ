"""Insights router contract: list, dismiss, run, RBAC, cross-org."""
from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.insight import Insight
from app.models.invoice import Customer, Invoice
from app.services.events import drain_events


def _register(client, email: str | None = None, password: str = "pw1234567"):
    email = email or f"u-{uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json(), email


async def _fetch_org_id(client, token: str) -> str:
    r = client.get("/org", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


async def _seed_insight(
    async_session,
    org_id: str,
    *,
    type_: str = "late_invoice",
    severity: str = "warn",
    title: str = "Test insight",
    body: str = "Body",
    evidence_ids: list[str] | None = None,
    status: str = "active",
) -> Insight:
    from app.services.insights import evidence_hash

    ev = evidence_ids or [str(uuid4())]
    row = Insight(
        id=str(uuid4()),
        org_id=org_id,
        type=type_,
        severity=severity,
        title=title,
        body=body,
        evidence_ids=ev,
        evidence_hash=evidence_hash(ev),
        status=status,
        dismissed_at=datetime.now(UTC) if status == "dismissed" else None,
    )
    async_session.add(row)
    await async_session.commit()
    return row


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_returns_active_only_by_default(client, async_session):
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)
    active = await _seed_insight(async_session, org_id, title="Active")
    dismissed = await _seed_insight(
        async_session, org_id, title="Dismissed", status="dismissed"
    )

    r = client.get(
        "/insights",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    ids = [row["id"] for row in body["items"]]
    assert active.id in ids
    assert dismissed.id not in ids


@pytest.mark.asyncio
async def test_list_dismissed_returns_dismissed(client, async_session):
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)
    dismissed = await _seed_insight(
        async_session, org_id, status="dismissed", title="Done"
    )

    r = client.get(
        "/insights?status=dismissed",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert dismissed.id in [row["id"] for row in r.json()["items"]]


@pytest.mark.asyncio
async def test_list_isolated_across_orgs(client, async_session):
    """A user must not see another org's insights."""
    reg_a, _ = _register(client)
    reg_b, _ = _register(client)
    token_a = reg_a["access_token"]
    token_b = reg_b["access_token"]
    org_b = await _fetch_org_id(client, token_b)
    foreign = await _seed_insight(async_session, org_b)

    r = client.get("/insights", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 200
    assert foreign.id not in [row["id"] for row in r.json()["items"]]


# ---------------------------------------------------------------------------
# Dismiss
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dismiss_marks_status_audits_and_publishes(client, async_session):
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)
    row = await _seed_insight(async_session, org_id)

    drain_events()
    r = client.post(
        f"/insights/{row.id}/dismiss",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "dismissed"

    audits = (
        await async_session.execute(
            select(AuditLog).where(
                AuditLog.entity_id == row.id,
                AuditLog.action == "insight.dismissed",
            )
        )
    ).scalars().all()
    assert len(audits) == 1

    events = drain_events()
    assert "insight.updated" in [t for (_, t, _) in events]


@pytest.mark.asyncio
async def test_dismiss_is_idempotent(client, async_session):
    """A second dismiss does not produce a second audit row."""
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)
    row = await _seed_insight(async_session, org_id, status="dismissed")

    r = client.post(
        f"/insights/{row.id}/dismiss",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    audits = (
        await async_session.execute(
            select(AuditLog).where(
                AuditLog.entity_id == row.id,
                AuditLog.action == "insight.dismissed",
            )
        )
    ).scalars().all()
    assert len(audits) == 0


@pytest.mark.asyncio
async def test_dismiss_404_on_other_orgs_insight(client, async_session):
    reg_a, _ = _register(client)
    reg_b, _ = _register(client)
    token_a = reg_a["access_token"]
    token_b = reg_b["access_token"]
    org_b = await _fetch_org_id(client, token_b)
    foreign = await _seed_insight(async_session, org_b)

    r = client.post(
        f"/insights/{foreign.id}/dismiss",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Run trigger
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_owner_can_trigger_and_creates_insights(client, async_session):
    """Owner can manually trigger; obvious facts produce at least one insight."""
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)

    # Seed a soon-to-renew commitment so the orchestrator has something to do.
    from app.models.commitment import Commitment

    cust = Customer(id=str(uuid4()), org_id=org_id, name_raw="ACME")
    async_session.add(cust)
    await async_session.flush()
    inv = Invoice(
        id=str(uuid4()),
        org_id=org_id,
        customer_id=cust.id,
        invoice_number="INV-1",
        issue_date=date.today().replace(day=1),
        due_date=date.today(),
        amount=Decimal("5000"),
        currency="USD",
        status="open",
    )
    cmt = Commitment(
        id=str(uuid4()),
        org_id=org_id,
        merchant_canonical="AWS",
        frequency="monthly",
        typical_amount=Decimal("2000"),
        currency="USD",
        last_seen_date=date.today(),
        next_due_date=date.today(),  # due today → inside the lookahead window
        confidence=0.9,
        enabled=True,
    )
    async_session.add_all([inv, cmt])
    await async_session.commit()

    r = client.post(
        "/insights/run",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["created"] >= 1

    # Subsequent GET surfaces them.
    listing = client.get(
        "/insights",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listing.status_code == 200
    assert listing.json()["items"]


@pytest.mark.asyncio
async def test_run_requires_admin_or_owner(client, async_session):
    """A plain ``member`` may not trigger a manual run."""
    reg, _ = _register(client)
    token = reg["access_token"]
    user_id = reg["user"]["id"]

    # Downgrade the user from owner to member by mutating their first membership.
    from app.models.org import Membership

    rows = (
        await async_session.execute(
            select(Membership).where(Membership.user_id == user_id)
        )
    ).scalars().all()
    for m in rows:
        m.role = "member"
    await async_session.commit()

    r = client.post(
        "/insights/run",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403
