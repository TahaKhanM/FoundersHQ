"""Seed dev/demo data for one org. Can be run from API (POST /ingest/sample-seed) or CLI.

The :func:`seed_org` coroutine is deterministic — callers pin ``today`` so
contract tests get the same row counts every run. The CLI entrypoint at the
bottom of the file defaults ``today`` to the system clock, which is fine
because dev seeding isn't compared against fixtures.
"""
import sys
from pathlib import Path

# When run as script (e.g. python app/scripts/seed_dev_data.py), ensure backend root is on path
_backend_root = Path(__file__).resolve().parent.parent.parent
if _backend_root.name == "backend" and str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import gen_uuid


@dataclass(frozen=True)
class SeedStats:
    transactions_inserted: int
    invoices_inserted: int
    customers_inserted: int
    commitments_inserted: int
    categories_inserted: int


async def seed_org(
    session: AsyncSession,
    org_id: str,
    *,
    today: date | None = None,
    commit: bool = True,
) -> SeedStats:
    """Insert a small deterministic fixture (txns/customers/invoices/commitment) for ``org_id``.

    ``today`` pins all relative dates so tests are reproducible; callers
    inside a FastAPI route pass ``today=date.today()``. ``commit`` defaults
    to True for CLI use; routers that own their own commit semantics pass
    ``commit=False``.
    """
    from app.models import commitment as comm_models
    from app.models import invoice as inv_models
    from app.models import transaction as txn_models

    anchor = today or date.today()

    cat1 = txn_models.TransactionCategory(id=gen_uuid(), org_id=org_id, name="Software")
    cat2 = txn_models.TransactionCategory(id=gen_uuid(), org_id=org_id, name="Office")
    session.add(cat1)
    session.add(cat2)
    await session.flush()

    txn_count = 10
    for i in range(txn_count):
        d = anchor - timedelta(days=i * 3)
        amt = Decimal("-500") if i % 2 == 0 else Decimal("2000")
        session.add(txn_models.Transaction(
            id=gen_uuid(),
            org_id=org_id,
            txn_date=d,
            description=f"Txn {i}",
            merchant_raw=f"Merchant_{i % 3}",
            merchant_canonical=f"Merchant_{i % 3}",
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

    invoice_count = 0
    for i, cust in enumerate([c1, c2]):
        for j in range(2):
            invoice_count += 1
            due = anchor + timedelta(days=30 * (j + 1))
            session.add(inv_models.Invoice(
                id=gen_uuid(),
                org_id=org_id,
                customer_id=cust.id,
                invoice_number=f"INV-{1000 + i * 10 + j}",
                issue_date=anchor - timedelta(days=10),
                due_date=due,
                amount=Decimal("5000") + Decimal(j * 1000),
                currency="USD",
                status="open" if j > 0 else "overdue",
            ))
    # Plus a one-off invoice so we hit 3 total without the cartesian product
    invoice_count += 1
    session.add(inv_models.Invoice(
        id=gen_uuid(),
        org_id=org_id,
        customer_id=c1.id,
        invoice_number="INV-2000",
        issue_date=anchor - timedelta(days=5),
        due_date=anchor + timedelta(days=15),
        amount=Decimal("7500"),
        currency="USD",
        status="open",
    ))
    await session.flush()

    session.add(comm_models.Commitment(
        id=gen_uuid(),
        org_id=org_id,
        merchant_canonical="Merchant_0",
        frequency="monthly",
        typical_amount=Decimal("500"),
        currency="USD",
        last_seen_date=anchor,
        next_due_date=anchor + timedelta(days=30),
        confidence=0.85,
        enabled=True,
    ))
    session.add(comm_models.Commitment(
        id=gen_uuid(),
        org_id=org_id,
        merchant_canonical="Merchant_1",
        frequency="monthly",
        typical_amount=Decimal("250"),
        currency="USD",
        last_seen_date=anchor,
        next_due_date=anchor + timedelta(days=30),
        confidence=0.7,
        enabled=True,
    ))
    await session.flush()

    if commit:
        await session.commit()

    return SeedStats(
        transactions_inserted=txn_count,
        invoices_inserted=invoice_count,
        customers_inserted=2,
        commitments_inserted=2,
        categories_inserted=2,
    )


if __name__ == "__main__":
    import asyncio

    from sqlalchemy import select
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import get_settings
    from app.models import org  # user first so Membership->User relationship resolves

    def main():
        settings = get_settings()
        engine = create_async_engine(settings.database_url)
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async def _run():
            async with async_session() as session:
                result = await session.execute(select(org.Org).limit(1))
                o = result.scalar_one_or_none()
                if not o:
                    # Create a default dev user + org so seed can run without registering first
                    from app.models.org import Membership
                    from app.models.user import User
                    from app.utils.hashing import hash_password
                    dev_user = User(
                        id=gen_uuid(),
                        email="dev@foundershq.local",
                        password_hash=hash_password("devpassword"),
                    )
                    session.add(dev_user)
                    await session.flush()
                    dev_org = org.Org(
                        id=gen_uuid(),
                        name="Dev Org",
                    )
                    session.add(dev_org)
                    await session.flush()
                    session.add(Membership(
                        id=gen_uuid(),
                        user_id=dev_user.id,
                        org_id=dev_org.id,
                        role="owner",
                    ))
                    await session.commit()
                    o = dev_org
                    print("Created dev user (dev@foundershq.local / devpassword) and org.")
                await seed_org(session, o.id)
                print(f"Seeded org {o.id}")

        try:
            asyncio.run(_run())
        except OperationalError as e:
            print("Database connection failed. Ensure Postgres is running and reachable.")
            print("  - If using Docker: run the seed inside the container:")
            print("    docker compose exec api python app/scripts/seed_dev_data.py")
            print("  - If running locally: set DATABASE_URL in .env to use localhost, e.g.")
            print("    DATABASE_URL=postgresql+asyncpg://foundershq:foundershq@localhost:5432/foundershq")
            raise SystemExit(1) from e

    main()
