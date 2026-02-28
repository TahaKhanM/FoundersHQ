"""LLM guardrails: facts payload, prompt instructions, post-validate numbers and citations."""
import hashlib
import json
import re
from typing import Any


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
    """
    disclaimers = []
    nums_in_response = extract_numbers_from_text(response_text)
    nums_in_facts = numbers_in_facts_payload(facts_payload)
    # Allow numbers that appear in facts (exact or normalized)
    for n in list(nums_in_response):
        if n in nums_in_facts:
            continue
        if n.rstrip("%") in nums_in_facts:
            continue
        if reject_on_unknown_numbers:
            return False, [], f"LLM response contains number '{n}' not present in facts payload"
    # Extract cited IDs (UUIDs mentioned in response)
    uuid_re = re.compile(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    )
    cited = set(uuid_re.findall(response_text))
    if cited and not cited.issubset(allowed_evidence_ids):
        disclaimers.append("Some citations may reference IDs not in allowed evidence set")
    return True, disclaimers, None


GUARDRAIL_PROMPT_INSTRUCTIONS = """Use ONLY the provided facts below. Do not compute new numbers or invent figures.
For any causal claim (e.g. "because", "due to", "caused by"), you MUST cite the relevant evidence ID (transaction ID or invoice ID) from the allowed list.
If you cannot answer from the facts, say so. Do not guess."""
