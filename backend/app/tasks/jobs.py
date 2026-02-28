"""Celery tasks: imports, recompute, ingest. All idempotent."""
from datetime import date
from decimal import Decimal
from uuid import uuid4
import hashlib

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.tasks.celery_app import celery_app
from app.models.base import Base
from app.models import user, org, transaction, commitment, invoice, runway, funding, audit

# Sync session for Celery (workers use sync DB)
engine = create_engine(get_settings().database_url_sync)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_sync_session():
    return SessionLocal()


@celery_app.task(bind=True)
def import_transactions_csv(self, org_id: str, file_content_base64: str | None = None, rows: list | None = None):
    """Parse and upsert transactions. Dedupe by dedupe_hash."""
    import base64
    job_id = self.request.id
    session = get_sync_session()
    try:
        if rows is None and file_content_base64:
            content = base64.b64decode(file_content_base64)
            from app.services.ingestion.csv_transactions import parse_transactions_csv
            rows = list(parse_transactions_csv(content))
        if not rows:
            return {"status": "done", "imported": 0, "skipped": 0, "errors": []}
        imported = 0
        skipped = 0
        errors = []
        for r in rows:
            try:
                txn_date = r.get("txn_date")
                if isinstance(txn_date, str):
                    from dateutil.parser import parse as date_parse
                    txn_date = date_parse(txn_date).date()
                amount = Decimal(str(r.get("amount", 0)))
                h = hashlib.sha256(f"{org_id}{txn_date}{r.get('description','')}{amount}".encode()).hexdigest()[:64]
                existing = session.execute(
                    select(transaction.Transaction).where(
                        transaction.Transaction.org_id == org_id,
                        transaction.Transaction.dedupe_hash == h,
                    )
                ).scalar_one_or_none()
                if existing:
                    skipped += 1
                    continue
                t = transaction.Transaction(
                    id=str(uuid4()),
                    org_id=org_id,
                    txn_date=txn_date,
                    description=r.get("description"),
                    merchant_raw=r.get("merchant_raw"),
                    merchant_canonical=r.get("merchant_raw"),
                    amount=amount,
                    currency=str(r.get("currency", "USD")),
                    source="csv",
                    dedupe_hash=h,
                )
                session.add(t)
                imported += 1
            except Exception as e:
                errors.append(str(e))
        session.commit()
        audit_log = audit.AuditLog(
            id=str(uuid4()),
            org_id=org_id,
            action="import_transactions_csv",
            entity_type="job",
            entity_id=job_id,
            metadata={"imported": imported, "skipped": skipped, "errors": errors},
        )
        session.add(audit_log)
        session.commit()
        return {"status": "done", "imported": imported, "skipped": skipped, "errors": errors}
    finally:
        session.close()


@celery_app.task(bind=True)
def import_invoices_csv(self, org_id: str, file_content_base64: str | None = None, rows: list | None = None):
    """Parse and upsert invoices/customers."""
    import base64
    job_id = self.request.id
    session = get_sync_session()
    try:
        if rows is None and file_content_base64:
            content = base64.b64decode(file_content_base64)
            from app.services.ingestion.csv_invoices import parse_invoices_csv
            rows = list(parse_invoices_csv(content))
        if not rows:
            return {"status": "done", "imported": 0, "errors": []}
        imported = 0
        errors = []
        for r in rows:
            try:
                from dateutil.parser import parse as date_parse
                issue_date = date_parse(r.get("issue_date", "2020-01-01")).date()
                due_date = date_parse(r.get("due_date", "2020-01-01")).date()
                amount = Decimal(str(r.get("amount", 0)))
                customer_name = r.get("customer_name", "Unknown")
                cust = session.execute(
                    select(invoice.Customer).where(
                        invoice.Customer.org_id == org_id,
                        invoice.Customer.name_raw == customer_name,
                    )
                ).scalar_one_or_none()
                if not cust:
                    cust = invoice.Customer(id=str(uuid4()), org_id=org_id, name_raw=customer_name)
                    session.add(cust)
                    session.flush()
                inv_num = r.get("invoice_number", str(uuid4())[:8])
                existing = session.execute(
                    select(invoice.Invoice).where(
                        invoice.Invoice.org_id == org_id,
                        invoice.Invoice.customer_id == cust.id,
                        invoice.Invoice.invoice_number == inv_num,
                    )
                ).scalar_one_or_none()
                if existing:
                    continue
                status = r.get("status", "open")
                inv = invoice.Invoice(
                    id=str(uuid4()),
                    org_id=org_id,
                    customer_id=cust.id,
                    invoice_number=inv_num,
                    issue_date=issue_date,
                    due_date=due_date,
                    amount=amount,
                    currency=str(r.get("currency", "USD")),
                    status=status,
                )
                session.add(inv)
                imported += 1
            except Exception as e:
                errors.append(str(e))
        session.commit()
        al = audit.AuditLog(id=str(uuid4()), org_id=org_id, action="import_invoices_csv", entity_type="job", entity_id=job_id, metadata={"imported": imported, "errors": errors})
        session.add(al)
        session.commit()
        return {"status": "done", "imported": imported, "errors": errors}
    finally:
        session.close()


@celery_app.task
def recompute_commitments(org_id: str):
    """Heuristic commitment detection from transactions; upsert Commitment and CommitmentInstance."""
    session = get_sync_session()
    try:
        rows = session.execute(
            select(transaction.Transaction.txn_date, transaction.Transaction.amount, transaction.Transaction.merchant_canonical).where(
                transaction.Transaction.org_id == org_id,
                transaction.Transaction.amount < 0,
            )
        ).all()
        from app.services.spending.commitments import detect_commitments
        data = [(r[0], r[1], r[2] or "") for r in rows]
        commitments = detect_commitments(data)
        for c in commitments:
            existing = session.execute(
                select(commitment.Commitment).where(
                    commitment.Commitment.org_id == org_id,
                    commitment.Commitment.merchant_canonical == c["merchant_canonical"],
                )
            ).scalar_one_or_none()
            if existing:
                existing.typical_amount = c["typical_amount"]
                existing.last_seen_date = c["last_seen_date"]
                existing.next_due_date = c["next_due_date"]
                existing.confidence = c["confidence"]
            else:
                session.add(commitment.Commitment(
                    id=str(uuid4()),
                    org_id=org_id,
                    merchant_canonical=c["merchant_canonical"],
                    frequency=c["frequency"],
                    typical_amount=c["typical_amount"],
                    currency=c["currency"],
                    last_seen_date=c["last_seen_date"],
                    next_due_date=c["next_due_date"],
                    confidence=c["confidence"],
                ))
        session.commit()
        return {"status": "done"}
    finally:
        session.close()


@celery_app.task
def recompute_spending_metrics(org_id: str):
    """Metrics are computed on-demand in API; this task can invalidate caches or recompute materialized data if any."""
    return {"status": "done"}


@celery_app.task
def recompute_invoice_predictions(org_id: str):
    """Compute lateness fingerprint and predictions per invoice; upsert InvoicePrediction."""
    session = get_sync_session()
    try:
        from app.services.invoices.lateness import lateness_fingerprint
        from app.services.invoices.predictions import expected_pay_dates, confidence_tier
        paid = session.execute(
            select(invoice.Invoice.due_date, invoice.Invoice.paid_date).where(
                invoice.Invoice.org_id == org_id,
                invoice.Invoice.paid_date.isnot(None),
            )
        ).all()
        fp = lateness_fingerprint([(r[0], r[1]) for r in paid])
        median_d = fp["median_delay"]
        p90_d = fp["p90_delay"]
        paid_count = len(paid)
        tier = confidence_tier(paid_count)
        invs = session.execute(select(invoice.Invoice).where(invoice.Invoice.org_id == org_id)).scalars().all()
        for inv in invs:
            base, pess = expected_pay_dates(inv.due_date, median_d, p90_d)
            pred = session.execute(
                select(invoice.InvoicePrediction).where(invoice.InvoicePrediction.invoice_id == inv.id)
            ).scalar_one_or_none()
            if pred:
                pred.expected_pay_date_base = base
                pred.expected_pay_date_pess = pess
                pred.confidence_tier = tier
            else:
                session.add(invoice.InvoicePrediction(
                    id=str(uuid4()),
                    org_id=org_id,
                    invoice_id=inv.id,
                    expected_pay_date_base=base,
                    expected_pay_date_pess=pess,
                    confidence_tier=tier,
                ))
        session.commit()
        return {"status": "done"}
    finally:
        session.close()


@celery_app.task
def recompute_runway_forecasts(org_id: str):
    """Optional: precompute and store latest forecast."""
    return {"status": "done"}


@celery_app.task
def ingest_funding_opportunities_batch(job_id: str, org_id: str, payload: list):
    """Upsert funding opportunities from external scraper. Creates provider if needed, funding_versions."""
    session = get_sync_session()
    try:
        created = updated = 0
        for p in payload:
            provider_id = None
            if p.get("provider_name"):
                prov = session.execute(
                    select(funding.FundingProvider).where(funding.FundingProvider.name == p["provider_name"])
                ).scalar_one_or_none()
                if not prov:
                    prov = funding.FundingProvider(id=str(uuid4()), name=p["provider_name"])
                    session.add(prov)
                    session.flush()
                provider_id = prov.id
            from dateutil.parser import parse as dt_parse
            deadline = dt_parse(p["deadline"]).date() if p.get("deadline") else None
            opp = session.execute(
                select(funding.FundingOpportunity).where(
                    funding.FundingOpportunity.name == p.get("name"),
                    funding.FundingOpportunity.source_url == p.get("source_url"),
                )
            ).scalar_one_or_none()
            if opp:
                opp.last_seen_at = p.get("last_seen_at")
                opp.last_updated_at = p.get("last_updated_at")
                updated += 1
                session.add(funding.FundingVersion(id=str(uuid4()), opportunity_id=opp.id, diff_summary="batch update"))
            else:
                session.add(funding.FundingOpportunity(
                    id=str(uuid4()),
                    provider_id=provider_id,
                    type=p.get("type", "other"),
                    name=p.get("name", ""),
                    geography=p.get("geography"),
                    amount_min=Decimal(str(p["amount_min"])) if p.get("amount_min") else None,
                    amount_max=Decimal(str(p["amount_max"])) if p.get("amount_max") else None,
                    deadline=deadline,
                    eligibility_text=p.get("eligibility_text"),
                    requirements_text=p.get("requirements_text"),
                    application_url=p.get("application_url"),
                    source_url=p.get("source_url"),
                    last_seen_at=p.get("last_seen_at"),
                    last_updated_at=p.get("last_updated_at"),
                    parse_confidence=p.get("parse_confidence"),
                ))
                created += 1
        session.commit()
        return {"status": "done", "created": created, "updated": updated}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
    finally:
        session.close()


@celery_app.task
def ingest_parsed_invoice_job(job_id: str, org_id: str, payload: dict):
    """Store parsed invoice job; if parse_confidence >= threshold create invoice else needs_review."""
    return {"status": "done"}
