"""Funding fit scoring: Eligibility, Speed, CostRisk, Control, RiskCompatibility. Deterministic rules."""
from decimal import Decimal


def score_route(
    route_type: str,
    b2b_invoice_share: float = 0.0,
    terms_days: int = 0,
    recurring_revenue: bool = False,
    margin_high: bool = False,
    runway_weeks: float | None = None,
    concentration_high: bool = False,
) -> tuple[float, dict[str, float], list[str]]:
    """Returns: (fit_score 0-100, breakdown dict, fired_rules list)."""
    breakdown = {"Eligibility": 50.0, "Speed": 50.0, "CostRisk": 50.0, "Control": 50.0, "RiskCompatibility": 50.0}
    fired = []
    if route_type in ("invoice_finance", "factoring") and b2b_invoice_share > 0.5 and terms_days >= 30:
        breakdown["Eligibility"] = min(100, breakdown["Eligibility"] + 25)
        fired.append("B2B invoice share high and terms>=30: boost invoice finance")
    if route_type == "rbf" and recurring_revenue and margin_high:
        breakdown["Eligibility"] = min(100, breakdown["Eligibility"] + 20)
        fired.append("Recurring revenue and margin high: boost RBF")
    if runway_weeks is not None and runway_weeks < 8:
        if route_type in ("invoice_finance", "rbf", "grant"):
            breakdown["Speed"] = min(100, breakdown["Speed"] + 15)
            fired.append("Runway<8w: boost fast routes")
        if route_type in ("vc", "grant"):
            breakdown["Speed"] = max(0, breakdown["Speed"] - 20)
            fired.append("Runway<8w: penalise slow routes")
    if concentration_high and route_type in ("debt", "loan"):
        breakdown["RiskCompatibility"] = max(0, breakdown["RiskCompatibility"] - 20)
        fired.append("Concentration high: penalise debt")
    fit = (
        breakdown["Eligibility"] * 0.30
        + breakdown["Speed"] * 0.25
        + breakdown["CostRisk"] * 0.15
        + breakdown["Control"] * 0.15
        + breakdown["RiskCompatibility"] * 0.15
    )
    return round(min(100, max(0, fit)), 1), breakdown, fired
