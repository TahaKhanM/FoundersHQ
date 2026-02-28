"""Spending alerts: spend creep, vendor anomaly. Deterministic."""
from decimal import Decimal
from datetime import date
from uuid import uuid4

from app.config import get_settings


def spend_creep_alerts(
    spend_creep_pct: float | None,
    threshold: float | None = None,
    evidence_ids: list[str] | None = None,
) -> list[dict]:
    """Return alert dicts if spend creep exceeds threshold."""
    if spend_creep_pct is None:
        return []
    t = threshold if threshold is not None else get_settings().spend_creep_alert_threshold
    if spend_creep_pct <= t:
        return []
    return [{
        "id": str(uuid4()),
        "type": "spend_creep",
        "title": "Spend creep detected",
        "message": f"Current week outflow is {spend_creep_pct:.0%} above baseline.",
        "severity": "warning",
        "evidence_ids": evidence_ids or [],
    }]
