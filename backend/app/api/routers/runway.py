"""Runway router: forecast compute, get, scenarios, milestones, attribution."""
from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from app.api.schemas import (
    RunwayForecastRequest,
    RunwayForecastDTO,
    WeeklyForecastRowDTO,
    RunwayForecastFullResponse,
    ScenarioCreate,
    MilestoneDTO,
    MilestoneCreate,
    MilestonePatch,
    AttributionItemDTO,
)
from app.deps import CurrentOrg, DbSession
from app.models import runway as rw_models
from app.utils.dates import week_start, iter_week_starts
from app.services.runway.forecast import run_forecast

router = APIRouter()


@router.post("/forecast/compute", response_model=RunwayForecastFullResponse)
async def compute_forecast(
    body: RunwayForecastRequest,
    org: CurrentOrg,
    session: DbSession,
):
    today = date.today()
    ws = week_start(today)
    horizon = body.horizon_weeks
    cash_start = Decimal("100000")  # TODO from questionnaire
    weekly_inflows = {ws + timedelta(days=7*i): Decimal("0") for i in range(horizon)}
    weekly_outflows = {ws + timedelta(days=7*i): Decimal("5000") for i in range(horizon)}
    rows, crash_base, crash_pess = run_forecast(cash_start, horizon, weekly_inflows, weekly_outflows, today)
    from app.models.base import gen_uuid
    fore = rw_models.RunwayForecast(
        id=gen_uuid(),
        org_id=org.id,
        horizon_weeks=horizon,
        cash_start=cash_start,
        currency="USD",
        crash_week_base=crash_base,
        crash_week_pess=crash_pess,
        cash_weeks_base=float(crash_base) if crash_base is not None else None,
        cash_weeks_pess=float(crash_pess) if crash_pess is not None else None,
        scenario_params=body.scenario_params,
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
    await session.commit()
    await session.refresh(fore)
    row_dtos = [WeeklyForecastRowDTO(week_start=r["week_start"], starting_cash=r["starting_cash"], inflows=r["inflows"], outflows=r["outflows"], ending_cash=r["ending_cash"], flags=r.get("flags"), evidence_ids=r.get("evidence_ids")) for r in rows]
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
        )
    )
    rows = rows_result.scalars().all()
    return RunwayForecastFullResponse(
        forecast=RunwayForecastDTO.model_validate(fore),
        rows=[WeeklyForecastRowDTO.model_validate(r) for r in rows],
        attribution=[],
    )


@router.post("/scenarios")
async def create_scenario(body: ScenarioCreate, org: CurrentOrg, session: DbSession):
    from app.models.base import gen_uuid
    s = rw_models.Scenario(id=gen_uuid(), org_id=org.id, name=body.name, params=body.params)
    session.add(s)
    await session.commit()
    await session.refresh(s)
    return {"id": s.id, "org_id": s.org_id, "name": s.name, "params": s.params}


@router.post("/scenarios/apply")
async def apply_scenario(org: CurrentOrg, session: DbSession):
    return {"message": "Apply scenario (no persistence unless requested)"}


@router.get("/milestones", response_model=list[MilestoneDTO])
async def list_milestones(org: CurrentOrg, session: DbSession):
    result = await session.execute(select(rw_models.Milestone).where(rw_models.Milestone.org_id == org.id))
    return [MilestoneDTO.model_validate(r) for r in result.scalars().all()]


@router.post("/milestones", response_model=MilestoneDTO)
async def create_milestone(body: MilestoneCreate, org: CurrentOrg, session: DbSession):
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
    await session.commit()
    await session.refresh(m)
    return MilestoneDTO.model_validate(m)


@router.patch("/milestones/{milestone_id}", response_model=MilestoneDTO)
async def patch_milestone(milestone_id: str, body: MilestonePatch, org: CurrentOrg, session: DbSession):
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
    await session.commit()
    await session.refresh(m)
    return MilestoneDTO.model_validate(m)


@router.delete("/milestones/{milestone_id}", status_code=204)
async def delete_milestone(milestone_id: str, org: CurrentOrg, session: DbSession):
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
    await session.commit()
    return None


@router.get("/attribution/{forecast_id}", response_model=list[AttributionItemDTO])
async def get_attribution(forecast_id: str, org: CurrentOrg, session: DbSession):
    return []
