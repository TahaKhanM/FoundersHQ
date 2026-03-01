"""LLM guardrails: facts payload, prompt instructions, post-validate numbers and citations."""
import hashlib
import json
import re
from typing import Any

CAUSAL_PATTERNS = re.compile(
    r"\b(because|due to|caused by|led to|owing to|as a result of)\b",
    re.IGNORECASE,
)
UUID_RE = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)


def _has_causal_claim(text: str) -> bool:
    return bool(CAUSAL_PATTERNS.search(text))


def _cited_evidence_ids(text: str) -> set[str]:
    return set(UUID_RE.findall(text))


def validate_causal_claims_require_evidence(
    response_text: str,
    allowed_evidence_ids: set[str],
) -> tuple[bool, str | None]:
    """If response contains causal language, at least one allowed evidence ID must appear. Returns (valid, error_message)."""
    if not _has_causal_claim(response_text):
        return True, None
    cited = _cited_evidence_ids(response_text)
    allowed_cited = cited & allowed_evidence_ids
    if not allowed_cited:
        return False, "Causal claim requires at least one evidence ID citation from the allowed set"
    return True, None


def build_facts_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()[:16]


def extract_numbers_from_text(text: str) -> set[str]:
    """Extract numeric tokens (integers and decimals) from text for validation."""
    # Match numbers: integers, decimals, percentages
    pattern = r"\d+\.?\d*%?|\d{1,3}(?:,\d{3})*(?:\.\d+)?"
    return set(re.findall(pattern, text))


def numbers_in_facts_payload(payload: dict[str, Any]) -> set[str]:
    """Recursively collect all numeric values from facts payload as strings."""
    nums = set()

    def collect(obj: Any) -> None:
        if isinstance(obj, (int, float)):
            nums.add(str(obj))
            nums.add(f"{obj:.2f}" if isinstance(obj, float) else str(obj))
        elif isinstance(obj, dict):
            for v in obj.values():
                collect(v)
        elif isinstance(obj, list):
            for x in obj:
                collect(x)
        elif isinstance(obj, str) and obj.replace(".", "").replace("-", "").isdigit():
            nums.add(obj)

    collect(payload)
    return nums


def validate_llm_response(
    response_text: str,
    facts_payload: dict[str, Any],
    allowed_evidence_ids: set[str],
    reject_on_unknown_numbers: bool = True,
) -> tuple[bool, list[str], str | None]:
    """
    Returns: (valid, disclaimers, error_message).
    If invalid and reject_on_unknown_numbers: error_message is set.
    Causal claims require at least one evidence ID in response.
    """
    disclaimers = []
    # Numbers: only those in facts
    nums_in_response = extract_numbers_from_text(response_text)
    nums_in_facts = numbers_in_facts_payload(facts_payload)
    for n in list(nums_in_response):
        if n in nums_in_facts:
            continue
        if n.rstrip("%") in nums_in_facts:
            continue
        if reject_on_unknown_numbers:
            return False, [], f"LLM response contains number '{n}' not present in facts payload"
    # Causal claims must cite evidence
    causal_ok, causal_err = validate_causal_claims_require_evidence(response_text, allowed_evidence_ids)
    if not causal_ok and causal_err:
        return False, [], causal_err
    # Citations subset of allowed
    cited = set(UUID_RE.findall(response_text))
    if cited and not cited.issubset(allowed_evidence_ids):
        disclaimers.append("Some citations may reference IDs not in allowed evidence set")
    return True, disclaimers, None


GUARDRAIL_PROMPT_INSTRUCTIONS = """Use ONLY the provided facts below. Do not compute new numbers or invent figures.
For any causal claim (e.g. "because", "due to", "caused by"), you MUST cite the relevant evidence ID (transaction ID or invoice ID) from the allowed list.
If you cannot answer from the facts, say so. Do not guess."""
