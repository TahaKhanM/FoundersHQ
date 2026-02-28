"""Invoice alerts: deterministic, with next_step_title, deep_link, evidence_ids."""
from decimal import Decimal
from uuid import uuid4


def invoice_overdue_alerts(
    overdue_count: int,
    overdue_sum: Decimal,
    evidence_ids: list[str],
) -> list[dict]:
    if overdue_count <= 0:
        return []
    return [{
        "id": str(uuid4()),
        "type": "invoice_overdue",
        "title": f"{overdue_count} overdue invoice(s)",
        "message": f"Total overdue: {overdue_sum}.",
        "severity": "critical" if overdue_count > 5 else "warning",
        "evidence_ids": evidence_ids,
        "next_step_title": "Review action queue",
        "deep_link": "/invoices",
    }]
