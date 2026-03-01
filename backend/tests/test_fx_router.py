"""Contract tests for the /fx router.

Covers:
- ``GET /fx/rates`` filter handling + auth requirement.
- ``POST /fx/rates`` admin-only gate (member -> 403, owner -> 200).
- Idempotent upsert: second call with same row is a no-op.
- Audit + event side effects fire on a successful bulk upsert.

Phase 2.C task 4.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.fx_rate import FxRate
from app.models.org import Membership
from app.models.user import User
from app.services.events import drain_events
from app.utils.hashing import hash_password
from app.utils.security import create_access_token


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client, email: str = "owner@example.com"):
    r = client.post("/auth/register", json={"email": email, "password": "pw1234567"})
    assert r.status_code == 200, r.text
    return r.json()


async def _attach_user(async_session, *, org_id: str, role: str) -> tuple[User, str]:
    u = User(
        id=str(uuid4()),
        email=f"u-{uuid4().hex[:6]}@ex.com",
        password_hash=hash_password("pw1234567"),
    )
    m = Membership(id=str(uuid4()), user_id=u.id, org_id=org_id, role=role)
    async_session.add_all([u, m])
    await async_session.commit()
    return u, create_access_token(u.id)


def _fetch_org_id(client, token: str) -> str:
    r = client.get("/org", headers=_auth(token))
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ---------------------------------------------------------------------------
# GET /fx/rates
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_fx_rates_requires_auth(client):
    r = client.get("/fx/rates")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_get_fx_rates_returns_filtered_rows(client, async_session):
    reg = _register(client, email="owner-list@ex.com")
    token = reg["access_token"]

    async_session.add_all(
        [
            FxRate(
                date=date(2026, 1, 1),
                source_currency="EUR",
                target_currency="USD",
                rate=Decimal("1.10"),
            ),
            FxRate(
                date=date(2026, 1, 2),
                source_currency="EUR",
                target_currency="USD",
                rate=Decimal("1.11"),
            ),
            FxRate(
                date=date(2026, 1, 1),
                source_currency="GBP",
                target_currency="USD",
                rate=Decimal("1.25"),
            ),
        ]
    )
    await async_session.commit()

    r = client.get(
        "/fx/rates?source=EUR&target=USD",
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 2
    sources = {row["source_currency"] for row in items}
    assert sources == {"EUR"}


@pytest.mark.asyncio
async def test_get_fx_rates_date_range_filter(client, async_session):
    reg = _register(client, email="owner-range@ex.com")
    token = reg["access_token"]

    async_session.add_all(
        [
            FxRate(
                date=date(2026, 1, 1),
                source_currency="EUR",
                target_currency="USD",
                rate=Decimal("1.10"),
            ),
            FxRate(
                date=date(2026, 2, 1),
                source_currency="EUR",
                target_currency="USD",
                rate=Decimal("1.11"),
            ),
            FxRate(
                date=date(2026, 3, 1),
                source_currency="EUR",
                target_currency="USD",
                rate=Decimal("1.12"),
            ),
        ]
    )
    await async_session.commit()

    r = client.get(
        "/fx/rates?source=EUR&target=USD&from=2026-01-15&to=2026-02-15",
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 1
    assert items[0]["date"] == "2026-02-01"


# ---------------------------------------------------------------------------
# POST /fx/rates (admin-only bulk upsert)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_post_fx_rates_member_forbidden(client, async_session):
    """Members may not bulk-upsert; only owner/admin."""
    reg = _register(client, email="owner-gate@ex.com")
    org_id = _fetch_org_id(client, reg["access_token"])

    # Make a second user with role=member.
    _, member_token = await _attach_user(async_session, org_id=org_id, role="member")

    r = client.post(
        "/fx/rates",
        json={
            "rows": [
                {
                    "date": "2026-01-01",
                    "source_currency": "EUR",
                    "target_currency": "USD",
                    "rate": "1.10",
                }
            ]
        },
        headers=_auth(member_token),
    )
    assert r.status_code == 403, r.text


@pytest.mark.asyncio
async def test_post_fx_rates_owner_inserts_and_audits(client, async_session):
    drain_events()  # clear queue
    reg = _register(client, email="owner-insert@ex.com")
    token = reg["access_token"]
    org_id = _fetch_org_id(client, token)

    r = client.post(
        "/fx/rates",
        json={
            "rows": [
                {
                    "date": "2026-01-01",
                    "source_currency": "EUR",
                    "target_currency": "USD",
                    "rate": "1.10",
                },
                {
                    "date": "2026-01-02",
                    "source_currency": "EUR",
                    "target_currency": "USD",
                    "rate": "1.11",
                },
            ]
        },
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body == {"inserted": 2, "updated": 0}

    rows = (await async_session.execute(select(FxRate))).scalars().all()
    assert len(rows) == 2

    audits = (
        await async_session.execute(
            select(AuditLog).where(
                AuditLog.org_id == org_id,
                AuditLog.action == "fx.rates_upserted",
            )
        )
    ).scalars().all()
    assert len(audits) == 1
    details = audits[0].details
    assert details["inserted"] == 2
    assert details["updated"] == 0
    assert details["count"] == 2

    events = drain_events()
    fx_events = [e for e in events if e[1] == "fx.rates_upserted"]
    assert len(fx_events) == 1
    assert fx_events[0][0] == org_id


@pytest.mark.asyncio
async def test_post_fx_rates_idempotent_second_call(client, async_session):
    reg = _register(client, email="owner-idem@ex.com")
    token = reg["access_token"]

    payload = {
        "rows": [
            {
                "date": "2026-01-01",
                "source_currency": "EUR",
                "target_currency": "USD",
                "rate": "1.10",
            }
        ]
    }
    r1 = client.post("/fx/rates", json=payload, headers=_auth(token))
    assert r1.status_code == 200, r1.text
    assert r1.json() == {"inserted": 1, "updated": 0}

    r2 = client.post("/fx/rates", json=payload, headers=_auth(token))
    assert r2.status_code == 200, r2.text
    # Same rate -> nothing changes.
    assert r2.json() == {"inserted": 0, "updated": 0}

    rows = (await async_session.execute(select(FxRate))).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_post_fx_rates_overwrites_existing_with_different_rate(
    client, async_session
):
    reg = _register(client, email="owner-update@ex.com")
    token = reg["access_token"]

    r1 = client.post(
        "/fx/rates",
        json={
            "rows": [
                {
                    "date": "2026-01-01",
                    "source_currency": "EUR",
                    "target_currency": "USD",
                    "rate": "1.10",
                }
            ]
        },
        headers=_auth(token),
    )
    assert r1.status_code == 200, r1.text

    r2 = client.post(
        "/fx/rates",
        json={
            "rows": [
                {
                    "date": "2026-01-01",
                    "source_currency": "EUR",
                    "target_currency": "USD",
                    "rate": "1.15",
                }
            ]
        },
        headers=_auth(token),
    )
    assert r2.status_code == 200, r2.text
    assert r2.json() == {"inserted": 0, "updated": 1}

    rows = (await async_session.execute(select(FxRate))).scalars().all()
    assert len(rows) == 1
    assert rows[0].rate == Decimal("1.15")
