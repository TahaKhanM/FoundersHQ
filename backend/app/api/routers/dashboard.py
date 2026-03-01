"""Dashboard router: health score, metrics, alerts (deterministic, C0 from financial_profile)."""
from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import HealthScoreResponse, HealthScoreBreakdownItem, DashboardMetricsDTO, AlertDTO
from app.deps import CurrentOrg, DbSession
from app.models import transaction as txn_models
from app.models import invoice as inv_models
from app.models import commitment as comm_models
from app.models import funding as fund_models
from app.models.financial_profile import FinancialProfile
from app.services.dashboard.health_score import compute_health_score
from app.services.spending.metrics import (
    cash_weeks,
    total_outflow,
    total_inflow,
    net_burn,
    run_rate_outflow,
    run_rate_net_burn,
    spend_creep_pct,
    compute_weekly_outflows_by_week,
    compute_baseline_weekly_outflow,
)
from app.services.spending.alerts import spend_creep_alerts
from app.services.invoices.alerts import invoice_overdue_alerts
from app.utils.dates import period_30d_end, period_90d_end

router = APIRouter()


@router.get("/metrics", response_model=DashboardMetricsDTO)
async def get_dashboard_metrics(org: CurrentOrg, session: DbSession):
    """Aggregated dashboard metrics from spending + invoices."""
    today = date.today()
    end_30 = period_30d_end(today)
    end_90 = period_90d_end(today)
    txn_result = await session.execute(
        select(txn_models.Transaction.txn_date, txn_models.Transaction.amount).where(
            txn_models.Transaction.org_id == org.id,
            txn_models.Transaction.txn_date >= end_90,
        )
    )
    rows = txn_result.all()
    amounts_30 = [r[1] for r in rows if r[0] >= end_30]
    amounts_90 = [r[1] for r in rows]
    out_30 = total_outflow(amounts_30)
    in_30 = total_inflow(amounts_30)
    nb_30 = net_burn(out_30, in_30)
    out_90 = total_outflow(amounts_90)
    in_90 = total_inflow(amounts_90)
    nb_90 = net_burn(out_90, in_90)
    rr_out = run_rate_outflow(out_90, 90)
    by_week = compute_weekly_outflows_by_week([(r[0], r[1]) for r in rows], today, 9)
    week_list = sorted(by_week.values(), reverse=True)
    baseline = compute_baseline_weekly_outflow(week_list, 1) if week_list else Decimal("0")
    current_week = week_list[0] if week_list else Decimal("0")
    creep = spend_creep_pct(baseline, current_week) if baseline else None
    if creep is None or creep == 0:
        spend_creep_status = "stable"
    elif creep > 0:
        spend_creep_status = "rising"
    else:
        spend_creep_status = "declining"

    open_result = await session.execute(
        select(func.count(inv_models.Invoice.id)).where(
            inv_models.Invoice.org_id == org.id,
            inv_models.Invoice.status.in_(["open", "overdue"]),
        )
    )
    overdue_result = await session.execute(
        select(func.count(inv_models.Invoice.id)).where(
            inv_models.Invoice.org_id == org.id,
            inv_models.Invoice.status == "overdue",
        )
    )
    open_count = open_result.scalar() or 0
    overdue_count = overdue_result.scalar() or 0
    overdue_ratio = (overdue_count / open_count) if open_count else 0.0

    fp_result = await session.execute(
        select(FinancialProfile).where(FinancialProfile.org_id == org.id)
    )
    fp = fp_result.scalar_one_or_none()
    cash_bal = fp.cash_balance if fp else Decimal("0")
    weekly_nb = (nb_90 * Decimal("7") / Decimal("90")) if nb_90 else Decimal("0")
    cw, _ = cash_weeks(cash_bal, weekly_nb)
    cash_weeks_val = float(cw) if cw is not None else 0.0
    runway_base = cash_weeks_val
    runway_pess = cash_weeks_val * 0.75 if cash_weeks_val else 0.0

    return DashboardMetricsDTO(
        cash_weeks=cash_weeks_val,
        net_burn_30d=nb_30,
        total_outflow_30d=out_30,
        spend_creep_status=spend_creep_status,
        overdue_ratio=round(overdue_ratio, 4),
        runway_base=round(runway_base, 1),
        runway_pess=round(runway_pess, 1),
    )


@router.get("/alerts", response_model=list[AlertDTO])
async def get_dashboard_alerts(org: CurrentOrg, session: DbSession):
    """Combined alerts for dashboard (spending + invoice overdue)."""
    today = date.today()
    end_90 = today - timedelta(days=90)
    txn_result = await session.execute(
        select(txn_models.Transaction.txn_date, txn_models.Transaction.amount).where(
            txn_models.Transaction.org_id == org.id,
            txn_models.Transaction.txn_date >= end_90,
        )
    )
    rows = txn_result.all()
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
        inv_ids = await session.execute(
            select(inv_models.Invoice.id).where(
                inv_models.Invoice.org_id == org.id,
                inv_models.Invoice.status == "overdue",
            )
        )
        evidence_ids = [r[0] for r in inv_ids.all()]
        alerts.extend(
            invoice_overdue_alerts(
                overdue_count=overdue_row[0],
                overdue_sum=overdue_row[1] or Decimal("0"),
                evidence_ids=evidence_ids,
            )
        )
    return [AlertDTO(**a) for a in alerts]


@router.get("/health-score", response_model=HealthScoreResponse)
async def get_health_score(org: CurrentOrg, session: DbSession):
    """Deterministic health score. Cash balance (C0) from financial_profile only."""
    notes = []
    today = date.today()
    end_90 = today - timedelta(days=90)

    fp_result = await session.execute(
        select(FinancialProfile).where(FinancialProfile.org_id == org.id)
    )
    fp = fp_result.scalar_one_or_none()
    cash_bal = fp.cash_balance if fp else None
    if cash_bal is None:
        notes.append("Cash balance not set; set via questionnaire for runway and health score.")

    txn_rows = await session.execute(
        select(txn_models.Transaction.txn_date, txn_models.Transaction.amount).where(
            txn_models.Transaction.org_id == org.id,
            txn_models.Transaction.txn_date >= end_90,
        )
    )
    txn_rows = txn_rows.all()
    has_90d_data = len(txn_rows) > 0
    amounts = [r[1] for r in txn_rows]
    out_90 = sum(max(Decimal("0"), -a) for a in amounts)
    in_90 = sum(max(Decimal("0"), a) for a in amounts)
    net_90 = out_90 - in_90
    weekly_nb = net_90 * Decimal("7") / Decimal("90") if (out_90 or in_90) else Decimal("0")
    cw, _ = cash_weeks(cash_bal or Decimal("0"), weekly_nb)
    cash_weeks_val = float(cw) if cw is not None else None

    paid_result = await session.execute(
        select(inv_models.Invoice.due_date, inv_models.Invoice.paid_date).where(
            inv_models.Invoice.org_id == org.id,
            inv_models.Invoice.paid_date.isnot(None),
        )
    )
    paid = paid_result.all()
    on_time = sum(1 for r in paid if r[1] and r[0] and r[1] <= r[0])
    on_time_ratio = (on_time / len(paid)) if paid else None

    conc_risk = 0.0
    cust_totals = await session.execute(
        select(inv_models.Invoice.customer_id, func.sum(inv_models.Invoice.amount).label("s")).where(
            inv_models.Invoice.org_id == org.id,
            inv_models.Invoice.status.in_(["open", "overdue"]),
        ).group_by(inv_models.Invoice.customer_id)
    )
    cust_totals = list(cust_totals.all())
    if cust_totals:
        total_open = sum(r[1] for r in cust_totals)
        if total_open and total_open > 0:
            max_cust = max(r[1] for r in cust_totals)
            conc_risk = float(max_cust / total_open)

    comm_result = await session.execute(
        select(func.count(comm_models.Commitment.id)).where(
            comm_models.Commitment.org_id == org.id,
        )
    )
    commitment_count = comm_result.scalar() or 0
    enabled_result = await session.execute(
        select(func.count(comm_models.Commitment.id)).where(
            comm_models.Commitment.org_id == org.id,
            comm_models.Commitment.enabled == True,
        )
    )
    enabled_count = enabled_result.scalar() or 0

    opp_count_result = await session.execute(
        select(func.count(fund_models.FundingOpportunity.id))
    )
    opp_count = opp_count_result.scalar() or 0

    score, breakdown = compute_health_score(
        cash_weeks=cash_weeks_val,
        run_rate_stable=True,
        has_90d_data=has_90d_data,
        on_time_ratio=on_time_ratio,
        concentration_risk=conc_risk,
        has_commitments=commitment_count > 0,
        commitment_enabled_count=enabled_count,
        funding_opportunity_count=opp_count,
    )
    return HealthScoreResponse(
        score=score,
        breakdown=[HealthScoreBreakdownItem(key=k, label=l, value=v, weightPct=w) for k, l, v, w in breakdown],
        notes=notes,
    )
