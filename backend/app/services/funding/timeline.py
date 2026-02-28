"""Timeline: order opportunities by urgency, deadline, cycle_time. Deterministic."""
from datetime import date


def timeline_sort_key(item: dict) -> tuple:
    deadline = item.get("deadline") or date(9999, 12, 31)
    cycle = item.get("cycle_time_days_est") or 999
    conf = item.get("parse_confidence") or 0
    return (deadline, cycle, -conf)


def rationale_for_item(opportunity: dict) -> str:
    parts = []
    if opportunity.get("deadline"):
        parts.append(f"Deadline {opportunity['deadline']}")
    if opportunity.get("cycle_time_days_est"):
        parts.append(f"Est. cycle {opportunity['cycle_time_days_est']} days")
    return "; ".join(parts) if parts else "Review eligibility"
