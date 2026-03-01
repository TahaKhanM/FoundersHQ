"""Invoices router: overview, list, detail, customers, action-queue, touches, templates."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    InvoiceOverviewDTO,
    InvoiceDTO,
    InvoiceDetailDTO,
    InvoicePredictionDTO,
    InvoiceRiskDTO,
    CustomerDTO,
    CustomerDetailDTO,
    ActionQueueItemDTO,
    TouchLogDTO,
    TouchLogCreate,
    InvoiceTemplatesRequest,
    InvoiceTemplateItem,
    PaginatedResponse,
    InvoiceParsingConfirmRequest,
)
from app.deps import CurrentOrg, DbSession, CurrentUserOptional
from app.config import get_settings
from app.models import invoice as inv_models
from app.services.invoices.action_queue import action_queue_item
from app.services.invoices.risk_scoring import priority_score_components
from app.utils.pagination import paginate

router = APIRouter()


@router.get("/overview", response_model=InvoiceOverviewDTO)
async def get_invoices_overview(org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(
            func.sum(inv_models.Invoice.amount).label("open_sum"),
            func.count(inv_models.Invoice.id).label("open_count"),
        ).where(
            inv_models.Invoice.org_id == org.id,
            inv_models.Invoice.status.in_(["open", "overdue"]),
        )
    )
    row = result.one_or_none()
    open_sum = row[0] or Decimal("0")
    open_count = row[1] or 0
    over_result = await session.execute(
        select(func.count(inv_models.Invoice.id)).where(
            inv_models.Invoice.org_id == org.id,
            inv_models.Invoice.status == "overdue",
        )
    )
    overdue_count = over_result.scalar() or 0
    overdue_sum_result = await session.execute(
        select(func.sum(inv_models.Invoice.amount)).where(
            inv_models.Invoice.org_id == org.id,
            inv_models.Invoice.status == "overdue",
        )
    )
    overdue_sum = overdue_sum_result.scalar() or Decimal("0")
    return InvoiceOverviewDTO(
        total_open=open_sum,
        total_overdue=overdue_sum,
        count_open=int(open_count),
        count_overdue=overdue_count,
        ageing_buckets={"0-30": open_sum, "31-60": Decimal("0"), "61-90": Decimal("0"), "90+": Decimal("0")},
        expected_cash_in_series=[],
        currency="USD",
    )


@router.get("", response_model=PaginatedResponse[InvoiceDTO])
async def list_invoices(
    org: CurrentOrg,
    session: DbSession,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
):
    q = select(inv_models.Invoice).where(inv_models.Invoice.org_id == org.id)
    if status:
        q = q.where(inv_models.Invoice.status == status)
    q = q.order_by(inv_models.Invoice.due_date.desc())
    count_q = select(func.count()).select_from(inv_models.Invoice).where(inv_models.Invoice.org_id == org.id)
    if status:
        count_q = count_q.where(inv_models.Invoice.status == status)
    total = (await session.execute(count_q)).scalar() or 0
    offset, limit, _ = paginate(total, page, page_size)
    result = await session.execute(q.offset(offset).limit(limit))
    items = [InvoiceDTO.model_validate(r) for r in result.scalars().all()]
    return PaginatedResponse(items=items, page=page, page_size=page_size, total=total)


@router.get("/action-queue", response_model=list[ActionQueueItemDTO])
async def get_action_queue(org: CurrentOrg, session: DbSession):
    settings = get_settings()
    completion_days = settings.action_queue_completion_days
    cutoff = datetime.now(timezone.utc) - timedelta(days=completion_days)

    # Invoices open/overdue with customer name; subquery for latest event per invoice
    result = await session.execute(
        select(
            inv_models.Invoice,
            inv_models.Customer.name_raw,
        )
        .join(
            inv_models.Customer,
            inv_models.Invoice.customer_id == inv_models.Customer.id,
        )
        .where(
            inv_models.Invoice.org_id == org.id,
            inv_models.Invoice.status.in_(["open", "overdue"]),
        )
    )
    rows = result.all()
    invoice_ids = [inv.id for inv, _ in rows]
    if not invoice_ids:
        return []

    # Latest event per invoice: created_at, touch_type
    events_result = await session.execute(
        select(
            inv_models.InvoiceEvent.invoice_id,
            func.max(inv_models.InvoiceEvent.created_at).label("last_at"),
        )
        .where(
            inv_models.InvoiceEvent.invoice_id.in_(invoice_ids),
            inv_models.InvoiceEvent.org_id == org.id,
        )
        .group_by(inv_models.InvoiceEvent.invoice_id)
    )
    last_event_at = {r[0]: r[1] for r in events_result.all()}

    # Latest touch_type per invoice (we need one row per invoice with max created_at)
    touch_type_by_inv: dict[str, str] = {}
    for inv_id in invoice_ids:
        r = await session.execute(
            select(inv_models.InvoiceEvent.touch_type)
            .where(
                inv_models.InvoiceEvent.invoice_id == inv_id,
                inv_models.InvoiceEvent.org_id == org.id,
            )
            .order_by(inv_models.InvoiceEvent.created_at.desc())
            .limit(1)
        )
        row = r.scalar_one_or_none()
        if row is not None:
            touch_type_by_inv[inv_id] = row if isinstance(row, str) else row[0]

    # Priority score and reasons from risk_scores if present, else compute
    risk_result = await session.execute(
        select(
            inv_models.InvoiceRiskScore.invoice_id,
            inv_models.InvoiceRiskScore.priority_score,
            inv_models.InvoiceRiskScore.reasons,
        ).where(
            inv_models.InvoiceRiskScore.invoice_id.in_(invoice_ids),
            inv_models.InvoiceRiskScore.org_id == org.id,
        )
    )
    risk_rows = risk_result.all()
    priority_by_inv: dict[str, float] = {}
    reasons_by_inv: dict[str, list[str]] = {}
    for inv_id, score, reasons in risk_rows:
        if inv_id not in priority_by_inv:
            priority_by_inv[inv_id] = float(score)
            reasons_by_inv[inv_id] = list(reasons) if isinstance(reasons, list) else []

    today = date.today()
    items = []
    for inv, cust_name in rows:
        days_overdue = (today - inv.due_date).days if today > inv.due_date else 0
        last_at = last_event_at.get(inv.id)
        last_type = touch_type_by_inv.get(inv.id) if last_at else None
        # completed = touched within N days (and we have a touch)
        if last_at is None:
            is_completed = False
        else:
            last_utc = last_at if last_at.tzinfo else last_at.replace(tzinfo=timezone.utc)
            is_completed = last_utc >= cutoff
        priority = priority_by_inv.get(inv.id)
        reasons: list[str] = reasons_by_inv.get(inv.id, [])
        if priority is None:
            priority, reasons = priority_score_components(
                inv.amount,
                inv.status == "overdue",
                days_overdue,
            )
        item = action_queue_item(
            inv.id,
            cust_name or "",
            inv.amount,
            inv.due_date,
            days_overdue,
            priority,
            [inv.id],
            last_touched_at=last_at,
            last_touch_type=last_type,
            is_completed=is_completed,
            reasons=reasons,
        )
        items.append(ActionQueueItemDTO(**item))

    # Deterministic ordering by priority_score descending (highest first)
    items.sort(key=lambda x: (-x.priority_score, x.due_date))
    return items


@router.get("/{invoice_id}", response_model=InvoiceDetailDTO)
async def get_invoice(invoice_id: str, org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(inv_models.Invoice).where(
            inv_models.Invoice.id == invoice_id,
            inv_models.Invoice.org_id == org.id,
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    cust_result = await session.execute(select(inv_models.Customer.name_raw).where(inv_models.Customer.id == inv.customer_id))
    cust_name = cust_result.scalar_one_or_none()
    pred_result = await session.execute(
        select(inv_models.InvoicePrediction).where(inv_models.InvoicePrediction.invoice_id == inv.id).order_by(inv_models.InvoicePrediction.computed_at.desc()).limit(1)
    )
    pred = pred_result.scalar_one_or_none()
    risk_result = await session.execute(
        select(inv_models.InvoiceRiskScore).where(inv_models.InvoiceRiskScore.invoice_id == inv.id).order_by(inv_models.InvoiceRiskScore.computed_at.desc()).limit(1)
    )
    risk = risk_result.scalar_one_or_none()
    events_result = await session.execute(select(inv_models.InvoiceEvent).where(inv_models.InvoiceEvent.invoice_id == inv.id))
    events = events_result.scalars().all()
    return InvoiceDetailDTO(
        **InvoiceDTO.model_validate(inv).model_dump(),
        customer_name=cust_name[0] if cust_name else None,
        predictions=InvoicePredictionDTO.model_validate(pred) if pred else None,
        risk=InvoiceRiskDTO.model_validate(risk) if risk else None,
        events=[TouchLogDTO.model_validate(e) for e in events],
        evidence_ids=[inv.id],
    )


@router.post("/touches", response_model=TouchLogDTO)
async def create_touch(
    body: TouchLogCreate,
    org: CurrentOrg,
    session: DbSession,
    user: CurrentUserOptional = None,
):
    if not body.invoice_id or not body.channel or not body.touch_type:
        raise HTTPException(400, "invoice_id, channel, and touch_type are required")
    inv_result = await session.execute(
        select(inv_models.Invoice).where(
            inv_models.Invoice.id == body.invoice_id,
            inv_models.Invoice.org_id == org.id,
        )
    )
    if not inv_result.scalar_one_or_none():
        raise HTTPException(404, "Invoice not found")
    from app.models.base import gen_uuid
    user_id = str(user.id) if user else None
    e = inv_models.InvoiceEvent(
        id=gen_uuid(),
        org_id=org.id,
        invoice_id=body.invoice_id,
        channel=body.channel,
        touch_type=body.touch_type,
        notes=body.notes,
        user_id=user_id,
    )
    session.add(e)
    await session.commit()
    await session.refresh(e)
    return TouchLogDTO.model_validate(e)


@router.post("/templates", response_model=list[InvoiceTemplateItem])
async def get_templates(body: InvoiceTemplatesRequest, org: CurrentOrg, session: DbSession):
    out = []
    for inv_id in body.invoice_ids:
        out.append(InvoiceTemplateItem(
            invoice_id=inv_id,
            template_key="reminder",
            subject="Payment reminder: Invoice #{{invoice_number}}",
            body="Hi, please find attached invoice #{{invoice_number}} for {{amount}} due {{due_date}}. Thank you.",
        ))
    return out


@router.get("/parsing/jobs/{job_id}")
async def get_parsing_job(job_id: str, org: CurrentOrg, session: DbSession):
    from fastapi import HTTPException
    result = await session.execute(
        select(inv_models.InvoiceParsingJob).where(
            inv_models.InvoiceParsingJob.id == job_id,
            inv_models.InvoiceParsingJob.org_id == org.id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Parsing job not found")
    return {"job_id": job.id, "status": job.status, "payload": job.payload, "extraction_report": job.extraction_report, "invoice_id": job.invoice_id}


@router.post("/parsing/jobs/{job_id}/confirm")
async def confirm_parsing_job(job_id: str, body: InvoiceParsingConfirmRequest, org: CurrentOrg, session: DbSession):
    from fastapi import HTTPException
    from app.models.base import gen_uuid
    from datetime import datetime
    result = await session.execute(
        select(inv_models.InvoiceParsingJob).where(
            inv_models.InvoiceParsingJob.id == job_id,
            inv_models.InvoiceParsingJob.org_id == org.id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Parsing job not found")
    cust = None
    if body.customer_id:
        r = await session.execute(
            select(inv_models.Customer).where(
                inv_models.Customer.id == body.customer_id,
                inv_models.Customer.org_id == org.id,
            )
        )
        cust = r.scalar_one_or_none()
    if not cust:
        cust = inv_models.Customer(id=gen_uuid(), org_id=org.id, name_raw=body.customer_name, name_canonical=body.customer_name)
        session.add(cust)
        await session.flush()
    inv = inv_models.Invoice(
        id=gen_uuid(),
        org_id=org.id,
        customer_id=cust.id,
        invoice_number=body.invoice_number,
        issue_date=body.issue_date,
        due_date=body.due_date,
        amount=body.amount,
        currency=body.currency,
        status="open",
        po_number=body.po_number,
        notes=body.notes,
    )
    session.add(inv)
    await session.flush()
    job.status = "confirmed"
    job.invoice_id = inv.id
    job.confirmed_at = datetime.utcnow()
    await session.commit()
    return {"invoice_id": inv.id, "status": "confirmed"}
