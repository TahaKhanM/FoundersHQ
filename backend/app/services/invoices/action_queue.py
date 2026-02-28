"""Action queue: ordered list of invoices to chase with suggested actions. Deterministic."""
from datetime import date, datetime
from decimal import Decimal


def action_queue_item(
    invoice_id: str,
    customer_name: str,
    amount: Decimal,
    due_date: date,
    days_overdue: int,
    priority_score: float,
    evidence_ids: list[str],
    last_touched_at: datetime | None = None,
    last_touch_type: str | None = None,
    is_completed: bool = False,
    reasons: list[str] | None = None,
) -> dict:
    if days_overdue <= 0:
        suggested = "reminder"
    elif days_overdue <= 14:
        suggested = "escalation"
    else:
        suggested = "escalation_urgent"
    return {
        "invoice_id": invoice_id,
        "customer_name": customer_name,
        "amount": amount,
        "due_date": due_date,
        "days_overdue": days_overdue,
        "priority_score": priority_score,
        "suggested_action": suggested,
        "evidence_ids": evidence_ids,
        "last_touched_at": last_touched_at,
        "last_touch_type": last_touch_type,
        "is_completed": is_completed,
        "reasons": reasons or [],
    }
