"""Attribution of significant dips/rises to evidence (txn ids, invoice ids). No LLM."""
from datetime import date
from decimal import Decimal
from typing import Any


def significance_threshold(avg_weekly_outflow: Decimal, fixed_amount_threshold: Decimal = Decimal("5000")) -> Decimal:
    return max(Decimal("0.3") * avg_weekly_outflow, fixed_amount_threshold)


def build_attribution(
    week_start: date,
    delta_amount: Decimal,
    evidence_ids: list[str],
    components: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "week_start": week_start,
        "delta_type": "dip" if delta_amount < 0 else "rise",
        "delta_amount": abs(delta_amount),
        "evidence_ids": evidence_ids,
        "components": components,
    }
