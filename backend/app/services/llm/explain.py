"""LLM explain: call external LLM with guardrails. Optional OpenAI."""
from typing import Any
import re
from app.config import get_settings
from app.services.llm.guardrails import (
    validate_llm_response,
    GUARDRAIL_PROMPT_INSTRUCTIONS,
)
from app.utils.evidence import extract_evidence_ids_from_payload


async def call_llm_explain(
    question: str,
    facts_payload: dict[str, Any],
    allowed_evidence_ids: set[str] | None = None,
    openai_api_key: str | None = None,
) -> tuple[str, list[str], float, list[str]]:
    """Returns: (answer, citations, confidence, disclaimers)."""
    if allowed_evidence_ids is None:
        allowed_evidence_ids = extract_evidence_ids_from_payload(facts_payload)
    import json
    prompt = f"{GUARDRAIL_PROMPT_INSTRUCTIONS}\n\nFacts (JSON):\n{json.dumps(facts_payload, default=str, indent=2)}\n\nQuestion: {question}\n\nAnswer (cite evidence IDs where relevant):"
    answer = ""
    try:
        if openai_api_key:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=openai_api_key)
            r = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=800,
            )
            answer = (r.choices[0].message.content or "").strip()
        else:
            answer = "No LLM configured. Provide OPENAI_API_KEY for explanations."
    except Exception:
        answer = "Unable to generate explanation at this time."
    valid, disclaimers, err = validate_llm_response(
        answer, facts_payload, allowed_evidence_ids,
        reject_on_unknown_numbers=get_settings().llm_guardrail_reject_on_unknown_numbers,
    )
    if not valid and err:
        answer = "I can only explain using the provided facts. Please rephrase or narrow your question."
        disclaimers.append(err)
    uuid_re = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
    citations = [c for c in uuid_re.findall(answer) if c in allowed_evidence_ids]
    confidence = 0.7 if valid else 0.4
    return answer, citations, confidence, disclaimers
