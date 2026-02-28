"""Apply categorization rules to transactions (deterministic match)."""
import re

def matches_rule(description: str | None, merchant_raw: str | None, pattern: str, match_type: str) -> bool:
    text = " ".join(filter(None, [description or "", merchant_raw or ""]))
    if match_type == "contains":
        return pattern.lower() in text.lower()
    if match_type == "regex":
        try:
            return bool(re.search(pattern, text, re.IGNORECASE))
        except re.error:
            return False
    return False
