"""FX rates router — list + admin-only bulk upsert.

``GET /fx/rates`` is auth-gated but not admin-gated: rates are universal
facts and every signed-in user may inspect them. ``POST /fx/rates`` is
gated to ``owner``/``admin`` because it mutates a globally-shared table;
every successful upsert writes an audit row and best-effort publishes an
event on the calling org's channel.
"""
from __future__ import annotations

import logging
from datetime import date as date_cls
from typing import Any

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.schemas import FxRateBulkIngestRequest, FxRateDTO, FxRateUpsertResult
from app.deps import CurrentOrg, CurrentUser, DbSession, requires_role
from app.models.fx_rate import FxRate
from app.models.org import Membership
from app.services.events import publish_event_best_effort
from app.services.fx.ingest import FxRateRow, upsert_rates
from app.utils.audit import record_audit

router = APIRouter()
log = logging.getLogger(__name__)


def _safe_publish(org_id: str, event_type: str, payload: dict[str, Any]) -> None:
    try:
        publish_event_best_effort(org_id, event_type, payload)
    except Exception:  # noqa: BLE001
        log.exception("publish_event failed for %s", event_type)


@router.get("/rates", response_model=list[FxRateDTO])
async def list_fx_rates(
    _org: CurrentOrg,
    _user: CurrentUser,
    session: DbSession,
    source: str | None = Query(None, min_length=3, max_length=8),
    target: str | None = Query(None, min_length=3, max_length=8),
    from_: date_cls | None = Query(None, alias="from"),
    to: date_cls | None = Query(None),
    limit: int = Query(500, ge=1, le=5000),
):
    """List FX rate snapshots, optionally filtered by pair and date range.

    Ordered by ``date`` ascending so callers can render a chart without
    re-sorting. Caps at ``limit`` rows — callers needing the full series
    paginate via narrower ``from``/``to`` windows.
    """
    q = select(FxRate)
    if source is not None:
        q = q.where(FxRate.source_currency == source)
    if target is not None:
        q = q.where(FxRate.target_currency == target)
    if from_ is not None:
        q = q.where(FxRate.date >= from_)
    if to is not None:
        q = q.where(FxRate.date <= to)
    q = q.order_by(FxRate.date.asc()).limit(limit)
    rows = (await session.execute(q)).scalars().all()
    return [FxRateDTO.model_validate(r) for r in rows]


@router.post("/rates", response_model=FxRateUpsertResult)
async def bulk_upsert_fx_rates(
    body: FxRateBulkIngestRequest,
    org: CurrentOrg,
    user: CurrentUser,
    session: DbSession,
    _membership: Membership = requires_role("owner", "admin"),
):
    """Admin-only bulk-load of FX rate rows. Idempotent.

    Persists audit + event side effects scoped to the calling org. The
    table itself isn't org-scoped (rates are universal), but a mutation to
    it is still attributable so we can answer "who fed bad rates?".
    """
    typed_rows: list[FxRateRow] = [
        {
            "date": row.date,
            "source_currency": row.source_currency,
            "target_currency": row.target_currency,
            "rate": row.rate,
        }
        for row in body.rows
    ]
    result = await upsert_rates(session, typed_rows)

    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="fx.rates_upserted",
        entity_type="fx_rates",
        entity_id="bulk",
        details={
            "count": len(typed_rows),
            "inserted": result["inserted"],
            "updated": result["updated"],
        },
    )
    _safe_publish(
        org.id,
        "fx.rates_upserted",
        {
            "count": len(typed_rows),
            "inserted": result["inserted"],
            "updated": result["updated"],
        },
    )

    return FxRateUpsertResult(**result)
