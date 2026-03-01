"""Global search router: deterministic ranking, org-scoped. No LLM."""
from datetime import date
from fastapi import APIRouter, Query
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import SearchResultDTO
from app.deps import CurrentOrg, DbSession
from app.models import transaction as txn_models
from app.models import invoice as inv_models
from app.models import commitment as comm_models
from app.models import funding as fund_models

router = APIRouter()

# Static pages/sections for deterministic search (no DB).
STATIC_PAGES = [
    {"type": "page", "id": "runway", "title": "Runway", "subtitle": "Cash runway forecast", "deep_link": "/runway"},
    {"type": "page", "id": "invoices", "title": "Invoices", "subtitle": "AR and action queue", "deep_link": "/invoices"},
    {"type": "page", "id": "spending", "title": "Spending", "subtitle": "Transactions and burn", "deep_link": "/spending"},
    {"type": "page", "id": "funding", "title": "Funding", "subtitle": "Funding opportunities", "deep_link": "/funding"},
    {"type": "page", "id": "dashboard", "title": "Dashboard", "subtitle": "Overview", "deep_link": "/dashboard"},
]

INVOICE_STATUS_WEIGHT = {"overdue": 1.0, "open": 0.7, "paid": 0.3, "cancelled": 0.0}


def _text_score(query_lower: str, field_value: str | None) -> float:
    if not field_value:
        return 0.0
    f = field_value.lower()
    if f == query_lower:
        return 1.0
    if f.startswith(query_lower):
        return 0.8
    if query_lower in f:
        return 0.5
    return 0.0


def _recency_score(d: date | None, reference: date) -> float:
    if d is None:
        return 0.5
    days_ago = (reference - d).days
    if days_ago <= 0:
        return 1.0
    if days_ago <= 7:
        return 0.9
    if days_ago <= 30:
        return 0.7
    if days_ago <= 90:
        return 0.5
    return 0.3


@router.get("", response_model=list[SearchResultDTO])
async def search(
    org: CurrentOrg,
    session: DbSession,
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
):
    query = q.strip()
    if not query:
        return []
    query_lower = query.lower()
    today = date.today()
    results: list[SearchResultDTO] = []

    type_hint = None
    if query_lower.startswith("inv_") or (len(query_lower) >= 36 and "inv" in query_lower[:4]):
        type_hint = "invoice"
    elif query_lower.startswith("txn_") or (len(query_lower) >= 36 and "txn" in query_lower[:4]):
        type_hint = "transaction"

    if len(query) >= 32:
        txn_row = await session.execute(
            select(txn_models.Transaction).where(
                txn_models.Transaction.org_id == org.id,
                txn_models.Transaction.id == query,
            )
        )
        t = txn_row.scalar_one_or_none()
        if t:
            results.append(SearchResultDTO(
                type="transaction",
                id=t.id,
                title=t.merchant_canonical or t.description or t.id,
                subtitle=f"{t.txn_date} · {t.amount} {t.currency}",
                snippet=t.description,
                deep_link="/spending/transactions",
                open_param=t.id,
                score=100.0,
                match_reason="exact_id",
            ))
        inv_row = await session.execute(
            select(inv_models.Invoice).where(
                inv_models.Invoice.org_id == org.id,
                inv_models.Invoice.id == query,
            )
        )
        inv = inv_row.scalar_one_or_none()
        if inv:
            results.append(SearchResultDTO(
                type="invoice",
                id=inv.id,
                title=inv.invoice_number,
                subtitle=f"{inv.status} · {inv.amount} {inv.currency}",
                snippet=inv.invoice_number,
                deep_link="/invoices/list",
                open_param=inv.id,
                score=100.0,
                match_reason="exact_id",
            ))

    txn_result = await session.execute(
        select(txn_models.Transaction).where(
            txn_models.Transaction.org_id == org.id,
            or_(
                txn_models.Transaction.merchant_canonical.ilike(f"%{query}%"),
                txn_models.Transaction.description.ilike(f"%{query}%"),
            ),
        ).order_by(txn_models.Transaction.txn_date.desc()).limit(50)
    )
    for t in txn_result.scalars().all():
        if any(r.id == t.id and r.type == "transaction" for r in results):
            continue
        title = t.merchant_canonical or t.description or t.id
        ts = max(
            _text_score(query_lower, t.merchant_canonical),
            _text_score(query_lower, t.description),
            _text_score(query_lower, t.id),
        )
        rec = _recency_score(t.txn_date, today)
        type_bonus = 0.2 if type_hint == "transaction" else 0.0
        score = (ts * 50 + rec * 20 + type_bonus * 30)
        results.append(SearchResultDTO(
            type="transaction",
            id=t.id,
            title=(title[:80] if title else t.id),
            subtitle=f"{t.txn_date} · {t.amount} {t.currency}",
            snippet=(t.description or "")[:120] if t.description else None,
            deep_link="/spending/transactions",
            open_param=t.id,
            score=round(score, 2),
            match_reason="text_match" if ts > 0 else "recency",
        ))

    inv_q = (
        select(inv_models.Invoice, inv_models.Customer.name_raw)
        .join(inv_models.Customer, inv_models.Invoice.customer_id == inv_models.Customer.id)
        .where(
            inv_models.Invoice.org_id == org.id,
            or_(
                inv_models.Invoice.invoice_number.ilike(f"%{query}%"),
                inv_models.Invoice.status.ilike(f"%{query}%"),
                inv_models.Customer.name_raw.ilike(f"%{query}%"),
            ),
        )
        .order_by(inv_models.Invoice.due_date.desc())
        .limit(50)
    )
    inv_result = await session.execute(inv_q)
    for inv, cust_name in inv_result.all():
        if any(r.id == inv.id and r.type == "invoice" for r in results):
            continue
        ts = max(
            _text_score(query_lower, inv.invoice_number),
            _text_score(query_lower, cust_name),
            _text_score(query_lower, inv.status),
        )
        status_w = INVOICE_STATUS_WEIGHT.get(inv.status, 0.5)
        rec = _recency_score(inv.due_date, today)
        type_bonus = 0.2 if type_hint == "invoice" else 0.0
        score = (ts * 40 + status_w * 25 + rec * 15 + type_bonus * 20)
        results.append(SearchResultDTO(
            type="invoice",
            id=inv.id,
            title=inv.invoice_number,
            subtitle=f"{cust_name or 'Unknown'} · {inv.status} · {inv.amount}",
            snippet=f"{inv.invoice_number} {cust_name or ''}",
            deep_link="/invoices/list",
            open_param=inv.id,
            score=round(score, 2),
            match_reason="text_match" if ts > 0 else "status",
        ))

    cust_result = await session.execute(
        select(inv_models.Customer).where(
            inv_models.Customer.org_id == org.id,
            or_(
                inv_models.Customer.name_raw.ilike(f"%{query}%"),
                and_(
                    inv_models.Customer.name_canonical.isnot(None),
                    inv_models.Customer.name_canonical.ilike(f"%{query}%"),
                ),
            ),
        ).limit(20)
    )
    for c in cust_result.scalars().all():
        if any(r.id == c.id and r.type == "customer" for r in results):
            continue
        ts = max(_text_score(query_lower, c.name_raw), _text_score(query_lower, c.name_canonical or ""))
        results.append(SearchResultDTO(
            type="customer",
            id=c.id,
            title=c.name_raw,
            subtitle="Customer",
            snippet=c.name_raw,
            deep_link="/invoices",
            open_param=c.id,
            score=round(ts * 60, 2),
            match_reason="text_match",
        ))

    comm_result = await session.execute(
        select(comm_models.Commitment).where(
            comm_models.Commitment.org_id == org.id,
            comm_models.Commitment.merchant_canonical.ilike(f"%{query}%"),
        ).limit(20)
    )
    for c in comm_result.scalars().all():
        ts = _text_score(query_lower, c.merchant_canonical)
        results.append(SearchResultDTO(
            type="commitment",
            id=c.id,
            title=c.merchant_canonical,
            subtitle=f"{c.frequency} · {c.typical_amount} {c.currency}",
            snippet=c.merchant_canonical,
            deep_link="/spending",
            open_param=c.id,
            score=round(ts * 50, 2),
            match_reason="text_match",
        ))

    opp_result = await session.execute(
        select(fund_models.FundingOpportunity).where(
            fund_models.FundingOpportunity.name.ilike(f"%{query}%"),
        ).limit(20)
    )
    for o in opp_result.scalars().all():
        ts = _text_score(query_lower, o.name)
        results.append(SearchResultDTO(
            type="funding_opportunity",
            id=o.id,
            title=o.name,
            subtitle=o.type,
            snippet=o.name,
            deep_link="/funding",
            open_param=o.id,
            score=round(ts * 50, 2),
            match_reason="text_match",
        ))

    for p in STATIC_PAGES:
        if query_lower in (p["title"].lower(), p["id"].lower()) or query_lower in (p.get("subtitle") or "").lower():
            results.append(SearchResultDTO(
                type="page",
                id=p["id"],
                title=p["title"],
                subtitle=p.get("subtitle"),
                snippet=p.get("subtitle"),
                deep_link=p["deep_link"],
                open_param=None,
                score=70.0,
                match_reason="text_match",
            ))

    results.sort(key=lambda r: (-r.score, r.type, r.id))
    return results[:limit]
