"""Org router: get org, delete org data."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import OrgDTO, OrgDataDeleteRequest
from app.deps import CurrentOrg, DbSession
from app.models import transaction, commitment, invoice, runway, funding
from app.models.audit import AuditLog
from app.models.llm import LLMExplanation
from app.models.funding import UserSavedOpportunity

router = APIRouter()


@router.get("", response_model=OrgDTO)
async def get_org(org: CurrentOrg):
    return OrgDTO.model_validate(org)


@router.delete("/data", status_code=204)
async def delete_org_data(
    body: OrgDataDeleteRequest,
    org: CurrentOrg,
    session: DbSession,
):
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Set confirm=true to delete org data")
    await session.execute(delete(UserSavedOpportunity).where(UserSavedOpportunity.org_id == org.id))
    await session.execute(delete(LLMExplanation).where(LLMExplanation.org_id == org.id))
    await session.execute(delete(AuditLog).where(AuditLog.org_id == org.id))
    await session.execute(delete(runway.Milestone).where(runway.Milestone.org_id == org.id))
    await session.execute(delete(runway.Scenario).where(runway.Scenario.org_id == org.id))
    await session.execute(delete(runway.ForecastRow).where(runway.ForecastRow.org_id == org.id))
    await session.execute(delete(runway.RunwayForecast).where(runway.RunwayForecast.org_id == org.id))
    for t in [invoice.InvoiceRiskScore, invoice.InvoicePrediction, invoice.InvoiceEvent, invoice.InvoiceParsingJob, invoice.Invoice, invoice.Customer]:
        await session.execute(delete(t).where(t.org_id == org.id))
    await session.execute(delete(commitment.CommitmentInstance).where(commitment.CommitmentInstance.org_id == org.id))
    await session.execute(delete(commitment.Commitment).where(commitment.Commitment.org_id == org.id))
    await session.execute(delete(transaction.CategorizationRule).where(transaction.CategorizationRule.org_id == org.id))
    await session.execute(delete(transaction.Transaction).where(transaction.Transaction.org_id == org.id))
    await session.execute(delete(transaction.TransactionCategory).where(transaction.TransactionCategory.org_id == org.id))
    await session.execute(delete(transaction.BankAccount).where(transaction.BankAccount.org_id == org.id))
    await session.commit()
    return None
