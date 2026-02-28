"""Invoice risk scoring: priority_score = weighted sum of impact, overdue, lateness, concentration, neglect. Reasons list."""
from decimal import Decimal


def priority_score_components(
    amount: Decimal,
    is_overdue: bool,
    lateness_days: int,
    concentration_risk: float = 0.0,
    neglect_risk: float = 0.0,
    impact_weight: float = 0.35,
    overdue_weight: float = 0.25,
    lateness_weight: float = 0.20,
    concentration_weight: float = 0.10,
    neglect_weight: float = 0.10,
) -> tuple[float, list[str]]:
    """Normalise to 0-100 scale and return reasons that contributed."""
    impact = min(1.0, float(amount) / 50000) if amount else 0
    overdue = 1.0 if is_overdue else 0.0
    lateness_n = min(1.0, lateness_days / 60)
    score = (
        impact_weight * impact
        + overdue_weight * overdue
        + lateness_weight * lateness_n
        + concentration_weight * concentration_risk
        + neglect_weight * neglect_risk
    ) * 100
    score = round(min(100, max(0, score)), 1)
    reasons = []
    if impact > 0.3:
        reasons.append("High impact amount")
    if is_overdue:
        reasons.append("Overdue")
    if lateness_days > 14:
        reasons.append(f"Lateness {lateness_days} days")
    if concentration_risk > 0.5:
        reasons.append("Customer concentration risk")
    if neglect_risk > 0.5:
        reasons.append("Low touch / neglect risk")
    return score, reasons


def risk_score_simple(overdue: bool, lateness_days: int) -> float:
    """Simple 0-100 risk score for display."""
    s = 0.0
    if overdue:
        s += 50
    s += min(50, lateness_days * 2)
    return min(100, s)
