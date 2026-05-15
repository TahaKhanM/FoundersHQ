"""Tests for deterministic search ranking (no LLM)."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from app.api.routers.search import (
    STATIC_PAGES,
    _recency_score,
    _text_score,
    search_insights,
)
from app.models.commitment import Commitment
from app.models.funding import FundingOpportunity
from app.models.invoice import Customer, Invoice
from app.models.org import Membership, Org
from app.models.transaction import Transaction
from app.models.user import User
from app.utils.hashing import hash_password
from app.utils.security import create_access_token

# ---------------------------------------------------------------------------
# Pure ranking unit tests (no DB).
# ---------------------------------------------------------------------------


def test_text_score_exact_match():
    assert _text_score("runway", "runway") == 1.0
    assert _text_score("runway", "Runway") == 1.0


def test_text_score_prefix():
    assert _text_score("run", "runway") == 0.8
    assert _text_score("inv", "invoices") == 0.8


def test_text_score_contains():
    assert _text_score("way", "runway") == 0.5
    assert _text_score("flow", "outflow") == 0.5


def test_text_score_no_match():
    assert _text_score("xyz", "runway") == 0.0
    assert _text_score("run", None) == 0.0


def test_recency_score_same_day():
    ref = date(2025, 3, 1)
    assert _recency_score(date(2025, 3, 1), ref) == 1.0


def test_recency_score_old():
    ref = date(2025, 3, 1)
    assert _recency_score(date(2024, 1, 1), ref) == 0.3


def test_recency_score_none():
    assert _recency_score(None, date(2025, 3, 1)) == 0.5


def test_static_pages_include_runway():
    ids = [p["id"] for p in STATIC_PAGES]
    assert "runway" in ids
    assert "dashboard" in ids


def test_search_ordering_deterministic():
    """Score desc, then type, then id gives stable order."""
    from app.api.schemas import SearchResultDTO

    a = SearchResultDTO(
        type="page", id="runway", title="Runway", deep_link="/runway",
        score=70.0, match_reason="text_match",
    )
    b = SearchResultDTO(
        type="page", id="dashboard", title="Dashboard", deep_link="/dashboard",
        score=70.0, match_reason="text_match",
    )
    sorted_list = sorted([b, a], key=lambda r: (-r.score, r.type, r.id))
    assert sorted_list[0].id == "dashboard"
    assert sorted_list[1].id == "runway"


def test_insights_channel_returns_empty_stub():
    """Phase 2.F replaces this stub with real insights.

    Until then, the channel must stay open (callable, deterministic) so the
    router can fold its output into results without conditional branches.
    """
    assert search_insights("any-org-id", "aws") == []
    assert search_insights("another-org-id", "anything") == []


# ---------------------------------------------------------------------------
# HTTP-level coverage: each entity type returns matching results, results
# stay scoped to CurrentOrg.
#
# Uses the shared `client` fixture which wires an in-memory aiosqlite session.
# We seed via the same `async_session` so the rows are visible to the
# request-scoped session.
# ---------------------------------------------------------------------------


async def _seed_org_and_token(async_session) -> tuple[Org, str]:
    """Create an org + owner + token. Commit so the request handler sees the rows."""
    org = Org(id=str(uuid4()), name=f"Acme-{uuid4().hex[:6]}")
    user = User(
        id=str(uuid4()),
        email=f"u-{uuid4().hex[:6]}@example.com",
        password_hash=hash_password("pw1234567"),
    )
    async_session.add_all([org, user])
    await async_session.flush()
    async_session.add(
        Membership(id=str(uuid4()), user_id=user.id, org_id=org.id, role="owner")
    )
    await async_session.commit()
    return org, create_access_token(user.id)


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_search_transactions_by_merchant(client, async_session):
    """Typing a merchant name surfaces transactions for the active org."""
    org, token = await _seed_org_and_token(async_session)
    async_session.add(
        Transaction(
            id=str(uuid4()),
            org_id=org.id,
            txn_date=date(2026, 4, 1),
            merchant_canonical="AWS",
            description="aws cloud services",
            amount=Decimal("-123.45"),
            currency="USD",
            source="csv",
        )
    )
    await async_session.commit()

    r = client.get("/search", params={"q": "AWS"}, headers=_auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    txns = [row for row in body if row["type"] == "transaction"]
    assert txns, f"expected a transaction result, got {body}"
    assert txns[0]["title"] == "AWS"
    assert txns[0]["deep_link"] == "/spending/transactions"
    assert txns[0]["open_param"]  # must be the txn id, for ?openTxnId=
    assert txns[0]["match_reason"] in {"text_match", "recency"}


@pytest.mark.asyncio
async def test_search_invoices_by_number_and_customer(client, async_session):
    """Invoice number OR customer name OR status all match."""
    org, token = await _seed_org_and_token(async_session)
    cust = Customer(
        id=str(uuid4()), org_id=org.id, name_raw="Globex Corp",
        name_canonical="globex corp",
    )
    async_session.add(cust)
    await async_session.flush()
    inv = Invoice(
        id=str(uuid4()),
        org_id=org.id,
        customer_id=cust.id,
        invoice_number="INV-2026-001",
        issue_date=date(2026, 3, 1),
        due_date=date(2026, 4, 1),
        amount=Decimal("5000.00"),
        currency="USD",
        status="overdue",
    )
    async_session.add(inv)
    await async_session.commit()

    # by invoice number fragment
    r = client.get("/search", params={"q": "2026-001"}, headers=_auth(token))
    assert r.status_code == 200, r.text
    invs = [row for row in r.json() if row["type"] == "invoice"]
    assert invs and invs[0]["title"] == "INV-2026-001"
    assert invs[0]["deep_link"] == "/invoices/list"
    assert invs[0]["open_param"] == inv.id

    # by customer name fragment
    r2 = client.get("/search", params={"q": "Globex"}, headers=_auth(token))
    assert r2.status_code == 200, r2.text
    types = {row["type"] for row in r2.json()}
    assert "invoice" in types
    assert "customer" in types  # customer row matches too


@pytest.mark.asyncio
async def test_search_customers(client, async_session):
    org, token = await _seed_org_and_token(async_session)
    async_session.add(
        Customer(
            id=str(uuid4()), org_id=org.id, name_raw="Initech LLC",
            name_canonical="initech llc",
        )
    )
    await async_session.commit()

    r = client.get("/search", params={"q": "Initech"}, headers=_auth(token))
    assert r.status_code == 200, r.text
    customers = [row for row in r.json() if row["type"] == "customer"]
    assert customers
    assert customers[0]["title"] == "Initech LLC"
    assert customers[0]["deep_link"] == "/invoices"


@pytest.mark.asyncio
async def test_search_commitments(client, async_session):
    org, token = await _seed_org_and_token(async_session)
    async_session.add(
        Commitment(
            id=str(uuid4()),
            org_id=org.id,
            merchant_canonical="Notion",
            frequency="monthly",
            typical_amount=Decimal("48.00"),
            currency="USD",
            last_seen_date=date(2026, 4, 1),
            confidence=0.9,
        )
    )
    await async_session.commit()

    r = client.get("/search", params={"q": "Notion"}, headers=_auth(token))
    assert r.status_code == 200, r.text
    commits = [row for row in r.json() if row["type"] == "commitment"]
    assert commits
    assert commits[0]["title"] == "Notion"
    assert commits[0]["deep_link"] == "/spending"


@pytest.mark.asyncio
async def test_search_funding_opportunities(client, async_session):
    """Funding opportunities are a global table (no org_id); covered for all orgs."""
    org, token = await _seed_org_and_token(async_session)
    async_session.add(
        FundingOpportunity(
            id=str(uuid4()),
            type="grant",
            name="SBIR Phase I",
        )
    )
    await async_session.commit()

    r = client.get("/search", params={"q": "SBIR"}, headers=_auth(token))
    assert r.status_code == 200, r.text
    opps = [row for row in r.json() if row["type"] == "funding_opportunity"]
    assert opps
    assert opps[0]["title"] == "SBIR Phase I"
    assert opps[0]["deep_link"] == "/funding"


@pytest.mark.asyncio
async def test_search_static_pages(client, async_session):
    """Static page entries match by title/id/subtitle."""
    _org, token = await _seed_org_and_token(async_session)

    r = client.get("/search", params={"q": "Runway"}, headers=_auth(token))
    assert r.status_code == 200, r.text
    pages = [row for row in r.json() if row["type"] == "page"]
    assert any(p["id"] == "runway" for p in pages)


@pytest.mark.asyncio
async def test_search_is_org_scoped(client, async_session):
    """Cross-tenant negative: results from another org are never returned."""
    # Org A — the requester. Seed a transaction visible to A only.
    org_a, token_a = await _seed_org_and_token(async_session)
    own_txn = Transaction(
        id=str(uuid4()),
        org_id=org_a.id,
        txn_date=date(2026, 4, 1),
        merchant_canonical="AWS",
        description="aws (own org)",
        amount=Decimal("-50.00"),
        currency="USD",
        source="csv",
    )
    async_session.add(own_txn)

    # Org B — different org, same merchant string. Also a customer + invoice
    # + commitment so we exercise every per-org scoped query.
    org_b = Org(id=str(uuid4()), name="Other Co")
    async_session.add(org_b)
    await async_session.flush()
    foreign_txn_id = str(uuid4())
    foreign_cust_id = str(uuid4())
    foreign_inv_id = str(uuid4())
    foreign_comm_id = str(uuid4())
    async_session.add_all([
        Transaction(
            id=foreign_txn_id,
            org_id=org_b.id,
            txn_date=date(2026, 4, 1),
            merchant_canonical="AWS",
            description="aws (foreign org)",
            amount=Decimal("-999.00"),
            currency="USD",
            source="csv",
        ),
        Customer(
            id=foreign_cust_id, org_id=org_b.id, name_raw="AWS Customer",
            name_canonical="aws customer",
        ),
    ])
    await async_session.flush()
    async_session.add_all([
        Invoice(
            id=foreign_inv_id,
            org_id=org_b.id,
            customer_id=foreign_cust_id,
            invoice_number="AWS-INV-1",
            issue_date=date(2026, 3, 1),
            due_date=date(2026, 4, 1),
            amount=Decimal("100.00"),
            currency="USD",
            status="open",
        ),
        Commitment(
            id=foreign_comm_id,
            org_id=org_b.id,
            merchant_canonical="AWS",
            frequency="monthly",
            typical_amount=Decimal("100.00"),
            currency="USD",
            last_seen_date=date(2026, 4, 1),
            confidence=0.5,
        ),
    ])
    await async_session.commit()

    r = client.get("/search", params={"q": "AWS"}, headers=_auth(token_a))
    assert r.status_code == 200, r.text
    body = r.json()

    foreign_ids = {foreign_txn_id, foreign_cust_id, foreign_inv_id, foreign_comm_id}
    leaked = [row for row in body if row["id"] in foreign_ids]
    assert leaked == [], f"cross-tenant leak: {leaked}"

    # Sanity: the requester's own AWS transaction IS returned.
    own_hits = [row for row in body if row["id"] == own_txn.id]
    assert own_hits, "own-org transaction should still be returned"


@pytest.mark.asyncio
async def test_search_deterministic_across_calls(client, async_session):
    """Same query, same data → identical ordering & scores. No randomness."""
    org, token = await _seed_org_and_token(async_session)
    base = date(2026, 4, 1)
    async_session.add_all([
        Transaction(
            id=str(uuid4()),
            org_id=org.id,
            txn_date=base - timedelta(days=i * 7),
            merchant_canonical=f"AWS {i}",
            description=f"aws charge {i}",
            amount=Decimal("-10.00"),
            currency="USD",
            source="csv",
        )
        for i in range(3)
    ])
    await async_session.commit()

    r1 = client.get("/search", params={"q": "AWS"}, headers=_auth(token)).json()
    r2 = client.get("/search", params={"q": "AWS"}, headers=_auth(token)).json()
    assert r1 == r2
    # Score-desc invariant
    scores = [row["score"] for row in r1]
    assert scores == sorted(scores, reverse=True)


@pytest.mark.asyncio
async def test_search_requires_auth(client):
    r = client.get("/search", params={"q": "AWS"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_search_empty_query_rejected(client, async_session):
    _org, token = await _seed_org_and_token(async_session)
    # FastAPI's Query(min_length=1) rejects empty strings at the validation layer.
    r = client.get("/search", params={"q": ""}, headers=_auth(token))
    assert r.status_code == 422
