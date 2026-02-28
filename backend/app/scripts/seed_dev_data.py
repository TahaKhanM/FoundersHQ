"""Seed dev/demo data for one org. Can be run from API (POST /ingest/sample-seed) or CLI."""
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.base import gen_uuid


async def seed_org(session: AsyncSession, org_id: str) -> None:
    """Add synthetic transactions, customers, invoices, commitments, funding opportunities for org_id."""
    from app.models import transaction as txn_models
    from app.models import commitment as comm_models
    from app.models import invoice as inv_models
    from app.models import funding as fund_models

    cat1 = txn_models.TransactionCategory(id=gen_uuid(), org_id=org_id, name="Software")
    cat2 = txn_models.TransactionCategory(id=gen_uuid(), org_id=org_id, name="Office")
    session.add(cat1)
    session.add(cat2)
    await session.flush()

    for i in range(30):
        d = date.today() - timedelta(days=i * 3)
        amt = Decimal("-500") if i % 2 == 0 else Decimal("2000")
        session.add(txn_models.Transaction(
            id=gen_uuid(),
            org_id=org_id,
            txn_date=d,
            description=f"Txn {i}",
            merchant_raw=f"Merchant_{i % 5}",
            merchant_canonical=f"Merchant_{i % 5}",
            amount=amt,
            currency="USD",
            source="questionnaire",
            dedupe_hash=gen_uuid()[:16],
        ))
    await session.flush()

    c1 = inv_models.Customer(id=gen_uuid(), org_id=org_id, name_raw="Acme Corp", name_canonical="Acme Corp")
    c2 = inv_models.Customer(id=gen_uuid(), org_id=org_id, name_raw="Beta Inc", name_canonical="Beta Inc")
    session.add(c1)
    session.add(c2)
    await session.flush()

    for i, cust in enumerate([c1, c2]):
        for j in range(3):
            due = date.today() + timedelta(days=30 * (j + 1))
            session.add(inv_models.Invoice(
                id=gen_uuid(),
                org_id=org_id,
                customer_id=cust.id,
                invoice_number=f"INV-{1000 + i*10 + j}",
                issue_date=date.today() - timedelta(days=10),
                due_date=due,
                amount=Decimal("5000") + Decimal(j * 1000),
                currency="USD",
                status="open" if j > 0 else "overdue",
            ))
    await session.flush()

    session.add(comm_models.Commitment(
        id=gen_uuid(),
        org_id=org_id,
        merchant_canonical="Merchant_0",
        frequency="monthly",
        typical_amount=Decimal("500"),
        currency="USD",
        last_seen_date=date.today(),
        next_due_date=date.today() + timedelta(days=30),
        confidence=0.85,
        enabled=True,
    ))
    await session.flush()

    prov = fund_models.FundingProvider(id=gen_uuid(), name="Demo Fund", provider_type="grant")
    session.add(prov)
    await session.flush()
    for i in range(3):
        session.add(fund_models.FundingOpportunity(
            id=gen_uuid(),
            provider_id=prov.id,
            type="grant" if i == 0 else "loan",
            name=f"Opportunity {i+1}",
            geography="US",
            amount_min=Decimal("10000"),
            amount_max=Decimal("100000"),
            deadline=date.today() + timedelta(days=60 + i*30),
            eligibility_text="Eligibility text",
            requirements_text="Requirements",
            application_url="https://example.com/apply",
            source_url="https://example.com",
            parse_confidence=0.9,
        ))
    await session.commit()
