"""Runway router: forecast compute, get, scenarios, milestones, attribution."""
from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.schemas import (
    AttributionItemDTO,
    MilestoneCreate,
    MilestoneDTO,
    MilestonePatch,
    RunwayForecastDTO,
    RunwayForecastFullResponse,
    RunwayForecastRequest,
    ScenarioCreate,
    WeeklyForecastRowDTO,
)
from app.deps import CurrentOrg, CurrentUser, DbSession, WritableOrg
from app.models import runway as rw_models
from app.models.financial_profile import FinancialProfile
from app.models.transaction import Transaction
from app.services.events import EventType, publish_event_best_effort
from app.services.runway.forecast import run_forecast
from app.services.runway.history import LOOKBACK_WEEKS, historical_weekly_flows
from app.services.runway.scenarios import apply_scenario_params
from app.utils.audit import record_audit
from app.utils.dates import week_start

router = APIRouter()
log = logging.getLogger(__name__)


def _safe_publish(org_id: str, event_type: EventType, payload: dict) -> None:
    try:
        publish_event_best_effort(org_id, event_type.value, payload)
    except Exception:  # noqa: BLE001
        log.exception("publish_event failed for %s", event_type.value)


@router.post("/forecast/compute", response_model=RunwayForecastFullResponse)
async def compute_forecast(
    body: RunwayForecastRequest,
    org: WritableOrg,
    user: CurrentUser,
    session: DbSession,
):
    today = date.today()
    ws = week_start(today)
    horizon = body.horizon_weeks
    if body.milestones:
        raise HTTPException(422, "Create milestones through /runway/milestones; they do not alter cash flows")
    profile = await session.scalar(select(FinancialProfile).where(FinancialProfile.org_id == org.id))
    if profile is None or profile.cash_balance is None:
        raise HTTPException(422, "Set a cash balance and currency through /ingest/questionnaire first")
    if profile.currency != org.base_currency:
        raise HTTPException(422, "Cash balance must be recorded in the organization base currency")
    txns = list((await session.scalars(select(Transaction).where(
        Transaction.org_id == org.id,
        Transaction.txn_date >= ws - timedelta(weeks=LOOKBACK_WEEKS),
        Transaction.txn_date < ws,
    ).order_by(Transaction.txn_date, Transaction.id))).all())
    if any(t.currency != org.base_currency for t in txns):
        raise HTTPException(422, "This forecast requires history in one base currency; mixed currencies are not summed")
    try:
        inflow, outflow = historical_weekly_flows([(t.txn_date, t.amount) for t in txns], today)
        weekly_outflows, weekly_inflows = apply_scenario_params(
            {ws + timedelta(weeks=i): outflow for i in range(horizon)},
            {ws + timedelta(weeks=i): inflow for i in range(horizon)}, body.scenario_params,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    cash_start = profile.cash_balance.quantize(Decimal("0.0001"))
    rows, crash_base, _ = run_forecast(cash_start, horizon, weekly_inflows, weekly_outflows, today)
    # A disclosed stress scenario, not a fitted confidence interval.
    _, crash_pess, _ = run_forecast(
        cash_start, horizon,
        {w: (v * Decimal("0.8")).quantize(Decimal("0.0001")) for w, v in weekly_inflows.items()},
        {w: (v * Decimal("1.2")).quantize(Decimal("0.0001")) for w, v in weekly_outflows.items()},
        today,
    )
    for row in rows:
        row["evidence_ids"] = [profile.id, *(t.id for t in txns)]
        row["flags"] = ["historical_average_8_complete_weeks", "stress_receipts_minus_20pct_costs_plus_20pct"]
    from app.models.base import gen_uuid
    fore = rw_models.RunwayForecast(
        id=gen_uuid(),
        org_id=org.id,
        horizon_weeks=horizon,
        cash_start=cash_start,
        currency=org.base_currency,
        crash_week_base=crash_base,
        crash_week_pess=crash_pess,
        cash_weeks_base=float(crash_base) if crash_base is not None else None,
        cash_weeks_pess=float(crash_pess) if crash_pess is not None else None,
        scenario_params={
            **(body.scenario_params or {}), "method": "historical_average_v1",
            "as_of": today.isoformat(), "lookback_weeks": LOOKBACK_WEEKS,
            "cash_balance_updated_at": profile.updated_at.isoformat(),
        },
    )
    session.add(fore)
    await session.flush()
    for r in rows:
        session.add(rw_models.ForecastRow(
            id=gen_uuid(),
            org_id=org.id,
            forecast_id=fore.id,
            week_start=r["week_start"],
            starting_cash=r["starting_cash"],
            inflows=r["inflows"],
            outflows=r["outflows"],
            ending_cash=r["ending_cash"],
            flags=r.get("flags"),
            evidence_ids=r.get("evidence_ids"),
        ))
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="runway.forecast_computed",
        entity_type="runway_forecast",
        entity_id=fore.id,
        details={"horizon_weeks": horizon, "crash_week_base": crash_base, "crash_week_pess": crash_pess},
    )
    await session.commit()
    await session.refresh(fore)
    row_dtos = [WeeklyForecastRowDTO(week_start=r["week_start"], starting_cash=r["starting_cash"], inflows=r["inflows"], outflows=r["outflows"], ending_cash=r["ending_cash"], flags=r.get("flags"), evidence_ids=r.get("evidence_ids")) for r in rows]
    _safe_publish(
        org.id,
        EventType.RUNWAY_FORECAST_COMPUTED,
        {
            "forecast_id": fore.id,
            "horizon_weeks": horizon,
            "crash_week_base": crash_base,
            "crash_week_pess": crash_pess,
        },
    )
    return RunwayForecastFullResponse(
        forecast=RunwayForecastDTO.model_validate(fore),
        rows=row_dtos,
        attribution=[],
    )


@router.get("/forecast/{forecast_id}", response_model=RunwayForecastFullResponse)
async def get_forecast(forecast_id: str, org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(rw_models.RunwayForecast).where(
            rw_models.RunwayForecast.id == forecast_id,
            rw_models.RunwayForecast.org_id == org.id,
        )
    )
    fore = result.scalar_one_or_none()
    if not fore:
        raise HTTPException(404, "Forecast not found")
    rows_result = await session.execute(
        select(rw_models.ForecastRow).where(
            rw_models.ForecastRow.forecast_id == forecast_id,
            rw_models.ForecastRow.org_id == org.id,
        ).order_by(rw_models.ForecastRow.week_start)
    )
    rows = rows_result.scalars().all()
    return RunwayForecastFullResponse(
        forecast=RunwayForecastDTO.model_validate(fore),
        rows=[WeeklyForecastRowDTO.model_validate(r) for r in rows],
        attribution=[],
    )


@router.post("/scenarios")
async def create_scenario(
    body: ScenarioCreate, org: WritableOrg, user: CurrentUser, session: DbSession
):
    from app.models.base import gen_uuid
    s = rw_models.Scenario(id=gen_uuid(), org_id=org.id, name=body.name, params=body.params)
    session.add(s)
    await session.flush()
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="runway.scenario_created",
        entity_type="scenario",
        entity_id=s.id,
        details={"name": body.name},
    )
    await session.commit()
    await session.refresh(s)
    _safe_publish(
        org.id, EventType.RUNWAY_SCENARIO_CREATED, {"scenario_id": s.id, "name": s.name}
    )
    return {"id": s.id, "org_id": s.org_id, "name": s.name, "params": s.params}


@router.post("/scenarios/apply")
async def apply_scenario(org: WritableOrg, session: DbSession):
    raise HTTPException(501, "Pass scenario_params to /runway/forecast/compute; applying saved scenarios is not implemented")


@router.get("/milestones", response_model=list[MilestoneDTO])
async def list_milestones(org: CurrentOrg, session: DbSession):
    result = await session.execute(select(rw_models.Milestone).where(rw_models.Milestone.org_id == org.id))
    return [MilestoneDTO.model_validate(r) for r in result.scalars().all()]


@router.post("/milestones", response_model=MilestoneDTO)
async def create_milestone(
    body: MilestoneCreate, org: WritableOrg, user: CurrentUser, session: DbSession
):
    from app.models.base import gen_uuid
    m = rw_models.Milestone(
        id=gen_uuid(),
        org_id=org.id,
        name=body.name,
        target_type=body.target_type,
        target_value=body.target_value,
        target_week_start=body.target_week_start,
    )
    session.add(m)
    await session.flush()
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="runway.milestone_created",
        entity_type="milestone",
        entity_id=m.id,
        details={"name": body.name, "target_type": body.target_type},
    )
    await session.commit()
    await session.refresh(m)
    _safe_publish(
        org.id, EventType.RUNWAY_MILESTONE_CREATED, {"milestone_id": m.id, "name": m.name}
    )
    return MilestoneDTO.model_validate(m)


@router.patch("/milestones/{milestone_id}", response_model=MilestoneDTO)
async def patch_milestone(
    milestone_id: str,
    body: MilestonePatch,
    org: WritableOrg,
    user: CurrentUser,
    session: DbSession,
):
    result = await session.execute(
        select(rw_models.Milestone).where(
            rw_models.Milestone.id == milestone_id,
            rw_models.Milestone.org_id == org.id,
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Milestone not found")
    if body.name is not None:
        m.name = body.name
    if body.target_type is not None:
        m.target_type = body.target_type
    if body.target_value is not None:
        m.target_value = body.target_value
    if body.target_week_start is not None:
        m.target_week_start = body.target_week_start
    await session.flush()
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="runway.milestone_updated",
        entity_type="milestone",
        entity_id=m.id,
        details=body.model_dump(exclude_none=True, mode="json"),
    )
    await session.commit()
    await session.refresh(m)
    _safe_publish(org.id, EventType.RUNWAY_MILESTONE_UPDATED, {"milestone_id": m.id})
    return MilestoneDTO.model_validate(m)


@router.delete("/milestones/{milestone_id}", status_code=204)
async def delete_milestone(
    milestone_id: str, org: WritableOrg, user: CurrentUser, session: DbSession
):
    result = await session.execute(
        select(rw_models.Milestone).where(
            rw_models.Milestone.id == milestone_id,
            rw_models.Milestone.org_id == org.id,
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Milestone not found")
    await session.delete(m)
    await session.flush()
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="runway.milestone_deleted",
        entity_type="milestone",
        entity_id=milestone_id,
    )
    await session.commit()
    _safe_publish(
        org.id, EventType.RUNWAY_MILESTONE_DELETED, {"milestone_id": milestone_id}
    )
    return


@router.get("/attribution/{forecast_id}", response_model=list[AttributionItemDTO])
async def get_attribution(forecast_id: str, org: CurrentOrg, session: DbSession):
    return []
