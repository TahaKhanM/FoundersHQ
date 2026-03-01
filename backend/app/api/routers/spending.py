"""Spending router: metrics, transactions, categories, rules, commitments, alerts."""
from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    SpendingMetricsDTO,
    SpendingReconciliationDTO,
    TransactionDTO,
    TransactionCategoryPatch,
    CategoryDTO,
    CategorizationRuleDTO,
    CategorizationRuleCreate,
    CategorizationRulePatch,
    CommitmentDTO,
    CommitmentPatch,
    AlertDTO,
    PaginationParams,
    PaginatedResponse,
)
from app.deps import CurrentOrg, DbSession
from app.models import transaction as txn_models
from app.models import commitment as comm_models
from app.services.spending.metrics import (
    total_outflow,
    total_inflow,
    net_burn,
    run_rate_outflow,
    run_rate_net_burn,
    spend_creep_pct,
    cash_weeks,
    buffer_ratio,
    revenue_breakeven_gap,
    compute_baseline_weekly_outflow,
    compute_weekly_outflows_by_week,
    reconcile_weekly_to_period,
)
from app.services.spending.alerts import spend_creep_alerts
from app.utils.dates import week_start, period_30d_end, period_90d_end
from app.utils.pagination import paginate

router = APIRouter()


@router.get("/metrics", response_model=SpendingMetricsDTO)
async def get_spending_metrics(org: CurrentOrg, session: DbSession):
    today = date.today()
    end_30 = period_30d_end(today)
    end_90 = period_90d_end(today)
    result = await session.execute(
        select(txn_models.Transaction.txn_date, txn_models.Transaction.amount, txn_models.Transaction.currency).where(
            txn_models.Transaction.org_id == org.id,
            txn_models.Transaction.txn_date >= end_90,
        )
    )
    rows = result.all()
    amounts_30 = [r[1] for r in rows if r[0] >= end_30]
    amounts_90 = [r[1] for r in rows]
    out_30 = total_outflow(amounts_30)
    out_90 = total_outflow(amounts_90)
    in_30 = total_inflow(amounts_30)
    in_90 = total_inflow(amounts_90)
    nb_30 = net_burn(out_30, in_30)
    nb_90 = net_burn(out_90, in_90)
    rr_out = run_rate_outflow(out_90, 90)
    rr_nb = run_rate_net_burn(nb_90, 90)
    by_week = compute_weekly_outflows_by_week([(r[0], r[1]) for r in rows], today, 9)
    week_list = sorted(by_week.values(), reverse=True)
    baseline = compute_baseline_weekly_outflow(week_list, 1) if week_list else Decimal("0")
    current_week = week_list[0] if week_list else Decimal("0")
    creep = spend_creep_pct(baseline, current_week) if baseline else None
    cash_bal = Decimal("0")  # TODO from questionnaire or bank
    weekly_nb = (nb_90 * Decimal("7")) / Decimal("90") if nb_90 else Decimal("0")
    cw, cw_flag = cash_weeks(cash_bal, weekly_nb)
    commitments_result = await session.execute(
        select(func.sum(comm_models.Commitment.typical_amount)).where(
            comm_models.Commitment.org_id == org.id,
            comm_models.Commitment.enabled == True,
        )
    )
    monthly_fixed = (commitments_result.scalar() or Decimal("0")) * Decimal("12/52")  # rough monthly
    buf = buffer_ratio(cash_bal, monthly_fixed) if monthly_fixed else None
    gap = revenue_breakeven_gap(rr_nb)
    currencies = set(r[2] for r in rows)
    multi_currency = len(currencies) > 1

    weekly_series = [(ws, tot) for ws, tot in sorted(by_week.items(), reverse=True)]
    mismatch, sum_weekly = reconcile_weekly_to_period(weekly_series, out_90)
    reconciliation = SpendingReconciliationDTO(
        weekly_outflow_series=[{"week_start": str(ws), "total_outflow": float(tot)} for ws, tot in weekly_series],
        period_outflow_total=out_90,
        sum_of_weekly_totals=sum_weekly,
        mismatch=mismatch,
        mismatch_note="Weekly series sum differs from period outflow total" if mismatch else None,
    )

    return SpendingMetricsDTO(
        total_outflow_30d=out_30,
        total_outflow_90d=out_90,
        total_inflow_30d=in_30,
        total_inflow_90d=in_90,
        net_burn_30d=nb_30,
        net_burn_90d=nb_90,
        run_rate_outflow=rr_out,
        run_rate_net_burn=rr_nb,
        spend_creep_pct=creep,
        spend_creep_alert=creep is not None and creep >= 0.25,
        cash_weeks=cw,
        cash_weeks_flag=cw_flag,
        buffer_ratio=buf,
        revenue_breakeven_gap=gap,
        currency="USD",
        multi_currency_warning=multi_currency,
        reconciliation=reconciliation,
    )


@router.get("/transactions", response_model=PaginatedResponse[TransactionDTO])
async def list_transactions(
    org: CurrentOrg,
    session: DbSession,
    page: int = 1,
    page_size: int = 20,
):
    q = select(txn_models.Transaction).where(txn_models.Transaction.org_id == org.id).order_by(txn_models.Transaction.txn_date.desc())
    count_q = select(func.count()).select_from(txn_models.Transaction).where(txn_models.Transaction.org_id == org.id)
    total = (await session.execute(count_q)).scalar() or 0
    offset, limit, _ = paginate(total, page, page_size)
    result = await session.execute(q.offset(offset).limit(limit))
    items = [TransactionDTO.model_validate(r) for r in result.scalars().all()]
    return PaginatedResponse(items=items, page=page, page_size=page_size, total=total)


@router.get("/transactions/{txn_id}", response_model=TransactionDTO)
async def get_transaction(txn_id: str, org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(txn_models.Transaction).where(
            txn_models.Transaction.id == txn_id,
            txn_models.Transaction.org_id == org.id,
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    return TransactionDTO.model_validate(txn)


@router.patch("/transactions/{txn_id}", response_model=TransactionDTO)
async def patch_transaction(txn_id: str, body: TransactionCategoryPatch, org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(txn_models.Transaction).where(
            txn_models.Transaction.id == txn_id,
            txn_models.Transaction.org_id == org.id,
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    if body.category_id is not None:
        txn.category_id = body.category_id
    await session.commit()
    await session.refresh(txn)
    return TransactionDTO.model_validate(txn)


@router.get("/categories", response_model=list[CategoryDTO])
async def list_categories(org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(txn_models.TransactionCategory).where(txn_models.TransactionCategory.org_id == org.id)
    )
    return [CategoryDTO.model_validate(r) for r in result.scalars().all()]


@router.get("/rules", response_model=list[CategorizationRuleDTO])
async def list_rules(org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(txn_models.CategorizationRule).where(txn_models.CategorizationRule.org_id == org.id)
    )
    return [CategorizationRuleDTO.model_validate(r) for r in result.scalars().all()]


@router.post("/rules", response_model=CategorizationRuleDTO)
async def create_rule(body: CategorizationRuleCreate, org: CurrentOrg, session: DbSession):
    from app.models.base import gen_uuid
    r = txn_models.CategorizationRule(
        id=gen_uuid(),
        org_id=org.id,
        pattern=body.pattern,
        match_type=body.match_type,
        category_id=body.category_id,
    )
    session.add(r)
    await session.commit()
    await session.refresh(r)
    return CategorizationRuleDTO.model_validate(r)


@router.patch("/rules/{rule_id}", response_model=CategorizationRuleDTO)
async def patch_rule(rule_id: str, body: CategorizationRulePatch, org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(txn_models.CategorizationRule).where(
            txn_models.CategorizationRule.id == rule_id,
            txn_models.CategorizationRule.org_id == org.id,
        )
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Rule not found")
    if body.pattern is not None:
        r.pattern = body.pattern
    if body.match_type is not None:
        r.match_type = body.match_type
    if body.category_id is not None:
        r.category_id = body.category_id
    if body.enabled is not None:
        r.enabled = body.enabled
    await session.commit()
    await session.refresh(r)
    return CategorizationRuleDTO.model_validate(r)


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: str, org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(txn_models.CategorizationRule).where(
            txn_models.CategorizationRule.id == rule_id,
            txn_models.CategorizationRule.org_id == org.id,
        )
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Rule not found")
    await session.delete(r)
    await session.commit()
    return None


@router.get("/commitments", response_model=list[CommitmentDTO])
async def list_commitments(org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(comm_models.Commitment).where(comm_models.Commitment.org_id == org.id)
    )
    return [CommitmentDTO.model_validate(r) for r in result.scalars().all()]


@router.patch("/commitments/{commitment_id}", response_model=CommitmentDTO)
async def patch_commitment(commitment_id: str, body: CommitmentPatch, org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(comm_models.Commitment).where(
            comm_models.Commitment.id == commitment_id,
            comm_models.Commitment.org_id == org.id,
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Commitment not found")
    if body.enabled is not None:
        c.enabled = body.enabled
    await session.commit()
    await session.refresh(c)
    return CommitmentDTO.model_validate(c)


@router.get("/alerts", response_model=list[AlertDTO])
async def list_alerts(org: CurrentOrg, session: DbSession):
    from app.services.spending.metrics import compute_weekly_outflows_by_week, compute_baseline_weekly_outflow, spend_creep_pct
    from app.services.invoices.alerts import invoice_overdue_alerts
    from app.models import invoice as inv_models
    from sqlalchemy import func

    today = date.today()
    end_90 = today - timedelta(days=90)
    result = await session.execute(
        select(txn_models.Transaction.txn_date, txn_models.Transaction.amount).where(
            txn_models.Transaction.org_id == org.id,
            txn_models.Transaction.txn_date >= end_90,
        )
    )
    rows = result.all()
    by_week = compute_weekly_outflows_by_week([(r[0], r[1]) for r in rows], today, 9)
    week_list = sorted(by_week.values(), reverse=True)
    baseline = compute_baseline_weekly_outflow(week_list, 1) if week_list else Decimal("0")
    current_week = week_list[0] if week_list else Decimal("0")
    creep = spend_creep_pct(baseline, current_week) if baseline else None
    alerts = spend_creep_alerts(creep, 0.25, [])

    overdue_result = await session.execute(
        select(
            func.count(inv_models.Invoice.id).label("c"),
            func.coalesce(func.sum(inv_models.Invoice.amount), 0).label("s"),
        ).where(
            inv_models.Invoice.org_id == org.id,
            inv_models.Invoice.status == "overdue",
        )
    )
    overdue_row = overdue_result.one_or_none()
    if overdue_row and (overdue_row[0] or 0) > 0:
        inv_ids_result = await session.execute(
            select(inv_models.Invoice.id).where(
                inv_models.Invoice.org_id == org.id,
                inv_models.Invoice.status == "overdue",
            )
        )
        evidence_ids = [r[0] for r in inv_ids_result.all()]
        alerts.extend(
            invoice_overdue_alerts(
                overdue_count=overdue_row[0],
                overdue_sum=overdue_row[1] or Decimal("0"),
                evidence_ids=evidence_ids,
            )
        )
    return [AlertDTO(**a) for a in alerts]
