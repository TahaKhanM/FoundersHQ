"""Improvement checklist: deterministic items. linkedModule, targetEvidenceIds."""
from uuid import uuid4


def improvement_items(
    spend_creep_merchants: list[tuple[str, str]],
    runway_weeks: float | None,
    overdue_invoice_ids: list[str],
    concentration_risk: bool,
) -> list[dict]:
    items = []
    for merchant, txn_id in spend_creep_merchants[:3]:
        items.append({
            "id": str(uuid4()),
            "linked_module": "spending",
            "title": "Reduce spend creep",
            "description": f"Review spend for {merchant}",
            "target_evidence_ids": [txn_id],
            "priority": 0.8,
        })
    if runway_weeks is not None and runway_weeks < 12:
        items.append({
            "id": str(uuid4()),
            "linked_module": "runway",
            "title": "Extend runway",
            "description": "Consider cost reduction or funding",
            "target_evidence_ids": [],
            "priority": 0.9,
        })
    for inv_id in overdue_invoice_ids[:5]:
        items.append({
            "id": str(uuid4()),
            "linked_module": "invoices",
            "title": "Reduce overdue ratio",
            "description": "Chase overdue invoice",
            "target_evidence_ids": [inv_id],
            "priority": 0.7,
        })
    if concentration_risk:
        items.append({
            "id": str(uuid4()),
            "linked_module": "funding",
            "title": "Reduce concentration risk",
            "description": "Diversify customer base",
            "target_evidence_ids": [],
            "priority": 0.6,
        })
    return items
