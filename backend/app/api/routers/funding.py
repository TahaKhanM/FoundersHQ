"""Funding router: routes rank, opportunities, save, timeline, improvements."""
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from app.api.schemas import (
    FundingRouteDTO,
    FundingOpportunityDTO,
    FundingOpportunitySaveRequest,
    FundingTimelineItemDTO,
    ImprovementItemDTO,
    PaginatedResponse,
)
from app.deps import CurrentOrg, DbSession, CurrentUser
from app.services.funding.scoring import score_route
from app.services.funding.timeline import timeline_sort_key, rationale_for_item
from app.services.funding.improvements import improvement_items
from app.utils.pagination import paginate

router = APIRouter()


@router.get("/routes/rank", response_model=list[FundingRouteDTO])
async def get_routes_rank(org: CurrentOrg, session: DbSession):
    routes = [
        ("invoice_finance", "Invoice finance"),
        ("rbf", "Revenue-based financing"),
        ("grant", "Grant"),
        ("vc", "Venture capital"),
        ("loan", "Loan"),
    ]
    out = []
    for route_type, name in routes:
        score, breakdown, fired = score_route(route_type, b2b_invoice_share=0.6, terms_days=45, runway_weeks=10)
        count_result = await session.execute(
            select(fund_models.FundingOpportunity).where(fund_models.FundingOpportunity.type == route_type)
        )
        count = len(count_result.scalars().all())
        out.append(FundingRouteDTO(
            route_type=route_type,
            name=name,
            fit_score=score,
            breakdown=breakdown,
            fired_rules=fired,
            opportunities_count=count,
        ))
    return out


@router.get("/opportunities", response_model=PaginatedResponse[FundingOpportunityDTO])
async def list_opportunities(
    org: CurrentOrg,
    session: DbSession,
    page: int = 1,
    page_size: int = 20,
    type: str | None = None,
):
    count_q = select(func.count()).select_from(fund_models.FundingOpportunity)
    if type:
        count_q = count_q.where(fund_models.FundingOpportunity.type == type)
    total = (await session.execute(count_q)).scalar() or 0
    q = select(fund_models.FundingOpportunity)
    if type:
        q = q.where(fund_models.FundingOpportunity.type == type)
    offset, limit, _ = paginate(total, page, page_size)
    q = q.offset(offset).limit(limit)
    result = await session.execute(q)
    items = []
    for opp in result.scalars().all():
        d = FundingOpportunityDTO.model_validate(opp)
        saved = await session.execute(
            select(fund_models.UserSavedOpportunity).where(
                fund_models.UserSavedOpportunity.org_id == org.id,
                fund_models.UserSavedOpportunity.opportunity_id == opp.id,
            )
        )
        s = saved.scalar_one_or_none()
        if s:
            d.saved_status = s.status
        items.append(d)
    return PaginatedResponse(items=items, page=page, page_size=page_size, total=total)


@router.post("/opportunities/save")
async def save_opportunity(body: FundingOpportunitySaveRequest, org: CurrentOrg, session: DbSession, user: CurrentUser):
    from app.models.base import gen_uuid
    existing = await session.execute(
        select(fund_models.UserSavedOpportunity).where(
            fund_models.UserSavedOpportunity.org_id == org.id,
            fund_models.UserSavedOpportunity.opportunity_id == body.opportunity_id,
        )
    )
    s = existing.scalar_one_or_none()
    if s:
        s.status = body.status
        s.notes = body.notes
    else:
        session.add(fund_models.UserSavedOpportunity(
            id=gen_uuid(),
            org_id=org.id,
            user_id=user.id,
            opportunity_id=body.opportunity_id,
            status=body.status,
            notes=body.notes,
        ))
    await session.commit()
    return {"status": "saved"}


@router.get("/timeline", response_model=list[FundingTimelineItemDTO])
async def get_timeline(org: CurrentOrg, session: DbSession):
    result = await session.execute(select(fund_models.FundingOpportunity))
    opps = result.scalars().all()
    sorted_opps = sorted(
        [{"id": o.id, "name": o.name, "type": o.type, "deadline": o.deadline, "cycle_time_days_est": o.cycle_time_days_est, "parse_confidence": o.parse_confidence} for o in opps],
        key=timeline_sort_key,
    )
    return [
        FundingTimelineItemDTO(
            opportunity_id=o["id"],
            name=o["name"],
            type=o["type"],
            recommended_by_date=o.get("deadline"),
            deadline=o.get("deadline"),
            rationale=rationale_for_item(o),
            urgency="medium",
        )
        for o in sorted_opps[:20]
    ]


@router.get("/improvements", response_model=list[ImprovementItemDTO])
async def get_improvements(org: CurrentOrg, session: DbSession):
    items = improvement_items(
        spend_creep_merchants=[],
        runway_weeks=10.0,
        overdue_invoice_ids=[],
        concentration_risk=False,
    )
    return [ImprovementItemDTO(**x) for x in items]
