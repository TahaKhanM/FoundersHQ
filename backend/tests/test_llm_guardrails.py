"""Tests for LLM guardrails: unknown numbers rejection, causal claim evidence requirement."""
import pytest
from app.services.llm.guardrails import (
    validate_llm_response,
    validate_causal_claims_require_evidence,
    extract_numbers_from_text,
    numbers_in_facts_payload,
)


def test_reject_invented_number():
    facts = {"transactions": [{"id": "inv-1", "amount": 100}]}
    response = "The total spend was 999 dollars."
    valid, _, err = validate_llm_response(
        response, facts, allowed_evidence_ids=set(), reject_on_unknown_numbers=True
    )
    assert valid is False
    assert "999" in (err or "")


def test_allow_number_from_facts():
    facts = {"transactions": [{"id": "inv-1", "amount": 100}]}
    response = "The amount is 100."
    valid, _, err = validate_llm_response(
        response, facts, allowed_evidence_ids=set(), reject_on_unknown_numbers=True
    )
    assert valid is True
    assert err is None


def test_causal_claim_without_evidence_rejected():
    response = "Burn increased because of higher marketing spend."
    allowed = set()
    valid, err = validate_causal_claims_require_evidence(response, allowed)
    assert valid is False
    assert "evidence" in (err or "").lower()


def test_causal_claim_with_evidence_accepted():
    uuid_val = "a1b2c3d4-e5f6-4789-a012-345678901234"
    response = f"Burn increased because of transaction {uuid_val} (higher marketing spend)."
    allowed = {uuid_val}
    valid, err = validate_causal_claims_require_evidence(response, allowed)
    assert valid is True
    assert err is None


def test_no_causal_claim_no_evidence_required():
    response = "Total outflow was 5000."
    valid, err = validate_causal_claims_require_evidence(response, set())
    assert valid is True
    assert err is None


def test_extract_numbers():
    assert "100" in extract_numbers_from_text("Amount is 100")
    assert "50.5" in extract_numbers_from_text("50.5% increase") or "50" in extract_numbers_from_text("50.5%")
