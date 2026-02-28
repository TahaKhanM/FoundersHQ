"""LLM router: explain, draft-collection-message. Guardrails enforced."""
from fastapi import APIRouter, Depends
from app.api.schemas import LLMExplainRequest, LLMExplainResponse, LLMDraftMessageRequest, LLMDraftMessageResponse
from app.deps import CurrentOrg, DbSession
from app.config import get_settings
from app.services.llm.facts_payload import build_facts_payload
from app.services.llm.explain import call_llm_explain
from app.services.llm.guardrails import build_facts_hash
from app.models.llm import LLMExplanation

router = APIRouter()


@router.post("/explain", response_model=LLMExplainResponse)
async def post_llm_explain(
    body: LLMExplainRequest,
    org: CurrentOrg,
    session: DbSession,
):
    # Build facts payload deterministically from context_modules
    metrics = {}
    transactions = []
    invoices = []
    if "spending" in body.context_modules:
        from sqlalchemy import select
        from app.models import transaction as txn_models
        result = await session.execute(
            select(txn_models.Transaction).where(txn_models.Transaction.org_id == org.id).limit(20)
        )
        transactions = [{"id": r.id, "amount": r.amount, "txn_date": str(r.txn_date), "merchant_canonical": r.merchant_canonical} for r in result.scalars().all()]
    if "invoices" in body.context_modules:
        from sqlalchemy import select
        from app.models import invoice as inv_models
        result = await session.execute(
            select(inv_models.Invoice).where(inv_models.Invoice.org_id == org.id).limit(20)
        )
        invoices = [{"id": r.id, "amount": r.amount, "due_date": str(r.due_date), "status": r.status} for r in result.scalars().all()]
    facts = build_facts_payload(metrics=metrics, transactions=transactions, invoices=invoices)
    from app.utils.evidence import extract_evidence_ids_from_payload
    allowed_ids = extract_evidence_ids_from_payload(facts)
    if body.focus_evidence_ids:
        allowed_ids = allowed_ids & set(body.focus_evidence_ids)
    answer, citations, confidence, disclaimers = await call_llm_explain(
        body.question,
        facts,
        allowed_evidence_ids=allowed_ids,
        openai_api_key=get_settings().openai_api_key,
    )
    # Store explanation
    from app.models.base import gen_uuid
    expl = LLMExplanation(
        id=gen_uuid(),
        org_id=org.id,
        module=",".join(body.context_modules) or "general",
        facts_hash=build_facts_hash(facts),
        request_payload={"question": body.question, "context_modules": body.context_modules},
        response_text=answer,
        citations=citations,
        confidence=confidence,
    )
    session.add(expl)
    await session.commit()
    return LLMExplainResponse(answer=answer, citations=citations, confidence=confidence, disclaimers=disclaimers)


@router.post("/draft-collection-message", response_model=LLMDraftMessageResponse)
async def draft_collection_message(
    body: LLMDraftMessageRequest,
    org: CurrentOrg,
    session: DbSession,
):
    from sqlalchemy import select
    from app.models import invoice as inv_models
    result = await session.execute(
        select(inv_models.Invoice).where(
            inv_models.Invoice.id == body.invoice_id,
            inv_models.Invoice.org_id == org.id,
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        return LLMDraftMessageResponse(message="[Invoice not found]", citations=[])
    # Deterministic template; no fabricated numbers
    msg = f"Hi, this is a {body.tone} reminder for invoice #{inv.invoice_number} for {inv.amount} {inv.currency} due {inv.due_date}. Please let us know if you have any questions."
    return LLMDraftMessageResponse(message=msg, citations=[inv.id])
