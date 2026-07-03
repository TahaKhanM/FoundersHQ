"""Ingest router: CSV uploads, questionnaire, sample seed, job status. Integration endpoints in separate router."""
from __future__ import annotations

import base64
import logging

from celery.result import AsyncResult
from fastapi import APIRouter, UploadFile
from sqlalchemy import select

from app.api.schemas import (
    IngestJobResponse,
    IngestJobStatusDTO,
    QuestionnairePayload,
    QuestionnaireSummary,
)
from app.deps import CurrentOrg, CurrentUser, CurrentUserOptional, DbSession
from app.services.events import EventType, publish_event_best_effort
from app.tasks.celery_app import celery_app
from app.tasks.jobs import import_invoices_csv, import_transactions_csv
from app.utils.audit import record_audit

router = APIRouter()
log = logging.getLogger(__name__)


def _safe_publish(org_id: str, event_type: EventType, payload: dict) -> None:
    try:
        publish_event_best_effort(org_id, event_type.value, payload)
    except Exception:  # noqa: BLE001
        log.exception("publish_event failed for %s", event_type.value)


@router.post("/transactions/csv", response_model=IngestJobResponse)
async def ingest_transactions_csv(
    file: UploadFile,
    org: CurrentOrg,
    session: DbSession,
    user: CurrentUserOptional = None,
):
    content = await file.read()
    b64 = base64.b64encode(content).decode()
    task = import_transactions_csv.delay(org.id, b64)
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id if user else None,
        action="ingest.transactions_csv_enqueued",
        entity_type="ingest_job",
        entity_id=task.id,
        details={"filename": file.filename, "bytes": len(content)},
    )
    _safe_publish(
        org.id,
        EventType.INGEST_JOB_ENQUEUED,
        {"job_id": task.id, "kind": "transactions_csv"},
    )
    return IngestJobResponse(job_id=task.id)


@router.get("/jobs/{job_id}", response_model=IngestJobStatusDTO)
async def get_ingest_job(job_id: str):
    r = AsyncResult(job_id, app=celery_app)
    status = r.state
    errors = []
    imported_transactions = imported_invoices = skipped = None
    if r.ready() and r.successful():
        res = r.result or {}
        if isinstance(res, dict):
            errors = res.get("errors", [])
            imported_transactions = res.get("imported")
            imported_invoices = res.get("imported")
            skipped = res.get("skipped")
    elif r.ready() and r.failed():
        errors = [str(r.result)] if r.result else ["Task failed"]
    return IngestJobStatusDTO(
        job_id=job_id,
        status=status,
        errors=errors,
        imported_transactions=imported_transactions,
        imported_invoices=imported_invoices,
        skipped=skipped,
    )


@router.post("/invoices/csv", response_model=IngestJobResponse)
async def ingest_invoices_csv(
    file: UploadFile,
    org: CurrentOrg,
    session: DbSession,
    user: CurrentUserOptional = None,
):
    content = await file.read()
    b64 = base64.b64encode(content).decode()
    task = import_invoices_csv.delay(org.id, b64)
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id if user else None,
        action="ingest.invoices_csv_enqueued",
        entity_type="ingest_job",
        entity_id=task.id,
        details={"filename": file.filename, "bytes": len(content)},
    )
    _safe_publish(
        org.id,
        EventType.INGEST_JOB_ENQUEUED,
        {"job_id": task.id, "kind": "invoices_csv"},
    )
    return IngestJobResponse(job_id=task.id)


@router.post("/questionnaire", response_model=QuestionnaireSummary)
async def ingest_questionnaire(
    body: QuestionnairePayload,
    org: CurrentOrg,
    user: CurrentUser,
    session: DbSession,
):
    from app.models.base import gen_uuid
    from app.models.financial_profile import FinancialProfile
    result = await session.execute(
        select(FinancialProfile).where(FinancialProfile.org_id == org.id)
    )
    fp = result.scalar_one_or_none()
    if fp:
        fp.cash_balance = body.cash_balance
        fp.currency = body.currency or fp.currency
    else:
        session.add(FinancialProfile(
            id=gen_uuid(),
            org_id=org.id,
            cash_balance=body.cash_balance,
            currency=body.currency,
        ))
    await session.flush()
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="questionnaire.saved",
        entity_type="financial_profile",
        entity_id=org.id,
        details={"cash_balance": str(body.cash_balance), "currency": body.currency},
    )
    await session.commit()
    _safe_publish(
        org.id,
        EventType.QUESTIONNAIRE_SAVED,
        {"cash_balance": str(body.cash_balance), "currency": body.currency},
    )
    return QuestionnaireSummary(saved=True, message="Questionnaire data saved")


@router.post("/sample-seed", response_model=dict)
async def ingest_sample_seed(
    org: CurrentOrg, user: CurrentUser, session: DbSession
):
    """Seed synthetic dataset for dev/demo. Calls script logic or inline seed."""
    from app.scripts.seed_dev_data import seed_org
    await seed_org(session, org.id)
    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="sample_data.seeded",
        entity_type="org",
        entity_id=org.id,
    )
    await session.commit()
    _safe_publish(org.id, EventType.SAMPLE_DATA_SEEDED, {"org_id": org.id})
    return {"message": "Sample data seeded"}
