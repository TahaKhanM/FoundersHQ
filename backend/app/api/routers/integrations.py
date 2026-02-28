"""Integration endpoints: funding opportunities batch ingest, invoice parsing ingest."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from app.api.schemas import (
    FundingOpportunitiesIngestRequest,
    FundingIngestStats,
    ParsedInvoicePayload,
)
from app.deps import CurrentOrg, DbSession
from app.models import funding as fund_models
from app.models import invoice as inv_models
from app.models.base import gen_uuid
from app.config import get_settings

router = APIRouter()


@router.post("/funding/opportunities", response_model=FundingIngestStats)
async def ingest_funding_opportunities(
    body: FundingOpportunitiesIngestRequest,
    org: CurrentOrg,
    session: DbSession,
):
    created = updated = errors = 0
    for p in body.opportunities:
        try:
            provider_id = None
            if p.provider_name:
                r = await session.execute(
                    select(fund_models.FundingProvider).where(fund_models.FundingProvider.name == p.provider_name)
                )
                prov = r.scalar_one_or_none()
                if not prov:
                    prov = fund_models.FundingProvider(id=gen_uuid(), name=p.provider_name)
                    session.add(prov)
                    await session.flush()
                provider_id = prov.id
            from dateutil.parser import parse as dt_parse
            deadline = dt_parse(p.deadline).date() if p.deadline else None
            opp = await session.execute(
                select(fund_models.FundingOpportunity).where(
                    fund_models.FundingOpportunity.name == p.name,
                    fund_models.FundingOpportunity.source_url == p.source_url,
                )
            )
            existing = opp.scalar_one_or_none()
            if existing:
                existing.last_seen_at = p.last_seen_at
                existing.last_updated_at = p.last_updated_at
                updated += 1
                session.add(fund_models.FundingVersion(id=gen_uuid(), opportunity_id=existing.id, diff_summary="batch"))
            else:
                session.add(fund_models.FundingOpportunity(
                    id=gen_uuid(),
                    provider_id=provider_id,
                    type=p.type,
                    name=p.name,
                    geography=p.geography,
                    amount_min=p.amount_min,
                    amount_max=p.amount_max,
                    deadline=deadline,
                    cycle_time_days_est=p.cycle_time_days_est,
                    eligibility_text=p.eligibility_text,
                    requirements_text=p.requirements_text,
                    application_url=p.application_url,
                    source_url=p.source_url,
                    last_seen_at=p.last_seen_at,
                    last_updated_at=p.last_updated_at,
                    parse_confidence=p.parse_confidence,
                    sector_tags=p.sector_tags,
                    stage_tags=p.stage_tags,
                ))
                created += 1
        except Exception:
            errors += 1
    await session.commit()
    return FundingIngestStats(created=created, updated=updated, errors=errors, total=len(body.opportunities))


@router.post("/invoices/parsed")
async def ingest_parsed_invoice(
    body: ParsedInvoicePayload,
    org: CurrentOrg,
    session: DbSession,
):
    """Accept extracted invoice fields. If parse_confidence < threshold or missing required -> needs_review."""
    threshold = get_settings().parse_confidence_threshold
    # Build extraction report from body (simplified: check required fields)
    confidences = []
    if body.invoice_number:
        confidences.append(body.invoice_number.confidence)
    if body.customer_name:
        confidences.append(body.customer_name.confidence)
    if body.due_date:
        confidences.append(body.due_date.confidence)
    if body.amount:
        confidences.append(body.amount.confidence)
    parse_confidence = min(confidences) if confidences else 0.0
    job = inv_models.InvoiceParsingJob(
        id=gen_uuid(),
        org_id=org.id,
        status="pending_review" if parse_confidence < threshold else "confirmed",
        payload=body.model_dump(mode="json"),
        extraction_report={"parse_confidence": parse_confidence, "confidences": confidences},
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return {"job_id": job.id, "status": job.status, "needs_review": parse_confidence < threshold}

