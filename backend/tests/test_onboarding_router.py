"""Phase 1.B: onboarding router contract tests.

Exercises GET /onboarding/state, POST /onboarding/step/{n}, POST
/onboarding/complete, POST /onboarding/seed-sample-data via the live
FastAPI app with the in-memory SQLite session.
"""
from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.invoice import Invoice
from app.models.org import Membership
from app.models.transaction import Transaction
from app.models.user import User
from app.services.events import drain_events
from app.utils.hashing import hash_password
from app.utils.security import create_access_token


def _register(client, email: str, password: str = "pw1234567"):
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


async def _attach_user(async_session, *, org_id: str, role: str = "member") -> tuple[User, str]:
    u = User(id=str(uuid4()), email=f"u-{uuid4().hex[:6]}@ex.com", password_hash=hash_password("pw1234567"))
    async_session.add(u)
    await async_session.flush()
    async_session.add(Membership(id=str(uuid4()), user_id=u.id, org_id=org_id, role=role))
    await async_session.commit()
    return u, create_access_token(u.id)


@pytest.mark.asyncio
async def test_get_state_starts_at_step_1(client):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    r = client.get(
        "/onboarding/state",
        headers={"Authorization": f"Bearer {owner['access_token']}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["step"] == 1
    assert body["completed_at"] is None
    assert body["captured"]["org_name"] is None
    assert body["captured"]["persona"] is None


@pytest.mark.asyncio
async def test_step_1_persists_org_profile_and_audits(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    drain_events()

    r = client.post(
        "/onboarding/step/1",
        headers={"Authorization": f"Bearer {owner['access_token']}"},
        json={
            "step": "org",
            "org_name": "Acme Robotics",
            "base_currency": "EUR",
            "fiscal_year_start_month": 4,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["step"] == 2
    assert body["captured"]["org_name"] == "Acme Robotics"
    assert body["captured"]["base_currency"] == "EUR"
    assert body["captured"]["fiscal_year_start_month"] == 4

    # Audit + event were written.
    rows = (await async_session.execute(
        select(AuditLog).where(AuditLog.action == "onboarding.step_completed")
    )).scalars().all()
    assert len(rows) == 1
    assert rows[0].details["step"] == 1
    types = [t for (_, t, _) in drain_events()]
    assert "onboarding.step_completed" in types


@pytest.mark.asyncio
async def test_step_2_requires_step_1_done_or_uses_persisted_state(client):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    headers = {"Authorization": f"Bearer {owner['access_token']}"}

    client.post("/onboarding/step/1", headers=headers, json={
        "step": "org", "org_name": "Acme", "base_currency": "USD", "fiscal_year_start_month": 1,
    })
    r = client.post(
        "/onboarding/step/2",
        headers=headers,
        json={"step": "persona", "persona": "first_time_founder"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["step"] == 3
    assert r.json()["captured"]["persona"] == "first_time_founder"


@pytest.mark.asyncio
async def test_step_1_rejects_malformed_payload(client):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    r = client.post(
        "/onboarding/step/1",
        headers={"Authorization": f"Bearer {owner['access_token']}"},
        json={
            "step": "org",
            "org_name": "",  # empty
            "base_currency": "USD",
            "fiscal_year_start_month": 1,
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_step_payload_must_match_step_number(client):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    r = client.post(
        "/onboarding/step/1",
        headers={"Authorization": f"Bearer {owner['access_token']}"},
        json={"step": "persona", "persona": "first_time_founder"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_complete_marks_onboarding_done_and_returns_org(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    headers = {"Authorization": f"Bearer {owner['access_token']}"}

    # Walk through steps 1–3.
    client.post("/onboarding/step/1", headers=headers, json={
        "step": "org", "org_name": "Acme", "base_currency": "USD", "fiscal_year_start_month": 1,
    })
    client.post("/onboarding/step/2", headers=headers, json={
        "step": "persona", "persona": "founder_operator",
    })
    client.post("/onboarding/step/3", headers=headers, json={
        "step": "data", "choice": "start_empty",
    })

    drain_events()
    r = client.post("/onboarding/complete", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["completed_at"] is not None
    assert body["org"]["name"] == "Acme"

    # Audit + event.
    rows = (await async_session.execute(
        select(AuditLog).where(AuditLog.action == "onboarding.completed")
    )).scalars().all()
    assert len(rows) == 1
    types = [t for (_, t, _) in drain_events()]
    assert "onboarding.completed" in types


@pytest.mark.asyncio
async def test_complete_before_steps_returns_422(client):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    headers = {"Authorization": f"Bearer {owner['access_token']}"}
    r = client.post("/onboarding/complete", headers=headers)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_get_state_after_completion_signals_done(client):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    headers = {"Authorization": f"Bearer {owner['access_token']}"}
    client.post("/onboarding/step/1", headers=headers, json={
        "step": "org", "org_name": "Acme", "base_currency": "USD", "fiscal_year_start_month": 1,
    })
    client.post("/onboarding/step/2", headers=headers, json={
        "step": "persona", "persona": "founder_operator",
    })
    client.post("/onboarding/step/3", headers=headers, json={
        "step": "data", "choice": "start_empty",
    })
    client.post("/onboarding/complete", headers=headers)

    r = client.get("/onboarding/state", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["completed_at"] is not None
    assert body["step"] == 4


@pytest.mark.asyncio
async def test_seed_sample_data_owner_only(client, async_session):
    """A non-owner cannot call POST /onboarding/seed-sample-data (403)."""
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}

    # Pull org id, attach a non-owner to it.
    org_id = client.get("/org", headers=owner_headers).json()["id"]
    _, member_token = await _attach_user(async_session, org_id=org_id, role="member")
    member_headers = {"Authorization": f"Bearer {member_token}"}

    r = client.post("/onboarding/seed-sample-data", headers=member_headers)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_seed_sample_data_owner_inserts_rows_and_audits(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    headers = {"Authorization": f"Bearer {owner['access_token']}"}
    org_id = client.get("/org", headers=headers).json()["id"]

    drain_events()
    r = client.post("/onboarding/seed-sample-data", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["transactions_inserted"] > 0
    assert body["invoices_inserted"] > 0

    # Rows are scoped to the caller's org.
    txns = (await async_session.execute(
        select(Transaction).where(Transaction.org_id == org_id)
    )).scalars().all()
    assert len(txns) >= 1
    invs = (await async_session.execute(
        select(Invoice).where(Invoice.org_id == org_id)
    )).scalars().all()
    assert len(invs) >= 1

    rows = (await async_session.execute(
        select(AuditLog).where(AuditLog.action == "onboarding.sample_data_seeded")
    )).scalars().all()
    assert len(rows) == 1
    types = [t for (_, t, _) in drain_events()]
    assert "onboarding.sample_data_seeded" in types


@pytest.mark.asyncio
async def test_unauthenticated_requests_are_401(client):
    r = client.get("/onboarding/state")
    assert r.status_code == 401
    r = client.post("/onboarding/step/1", json={"step": "org", "org_name": "x", "base_currency": "USD", "fiscal_year_start_month": 1})
    assert r.status_code == 401
