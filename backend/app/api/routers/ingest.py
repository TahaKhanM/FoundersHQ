"""Ingest router: CSV uploads, questionnaire, sample seed, job status. Integration endpoints in separate router."""
from fastapi import APIRouter, Depends, UploadFile, HTTPException
from celery.result import AsyncResult
from sqlalchemy import select

from app.api.schemas import IngestJobResponse, IngestJobStatusDTO, QuestionnairePayload, QuestionnaireSummary
from app.deps import CurrentOrg, DbSession
from app.tasks.celery_app import celery_app
from app.tasks.jobs import import_transactions_csv, import_invoices_csv
import base64

router = APIRouter()


@router.post("/transactions/csv", response_model=IngestJobResponse)
async def ingest_transactions_csv(
    file: UploadFile,
    org: CurrentOrg,
):
    content = await file.read()
    b64 = base64.b64encode(content).decode()
    task = import_transactions_csv.delay(org.id, b64)
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
):
    content = await file.read()
    b64 = base64.b64encode(content).decode()
    task = import_invoices_csv.delay(org.id, b64)
    return IngestJobResponse(job_id=task.id)


@router.post("/questionnaire", response_model=QuestionnaireSummary)
async def ingest_questionnaire(body: QuestionnairePayload, org: CurrentOrg, session: DbSession):
    from app.models.financial_profile import FinancialProfile
    from app.models.base import gen_uuid
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
    await session.commit()
    return QuestionnaireSummary(saved=True, message="Questionnaire data saved")


@router.post("/sample-seed", response_model=dict)
async def ingest_sample_seed(org: CurrentOrg, session: DbSession):
    """Seed synthetic dataset for dev/demo. Calls script logic or inline seed."""
    from app.scripts.seed_dev_data import seed_org
    await seed_org(session, org.id)
    return {"message": "Sample data seeded"}
