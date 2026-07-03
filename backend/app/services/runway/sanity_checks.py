"""Sanity checks: flag unusually low/high outflows vs baseline."""
from decimal import Decimal


def sanity_check_outflows(
    weekly_outflow: Decimal,
    baseline_weekly_outflow: Decimal,
    commitments_unchanged: bool = True,
) -> list[str]:
    flags = []
    if baseline_weekly_outflow and baseline_weekly_outflow > 0:
        pct = float((weekly_outflow - baseline_weekly_outflow) / baseline_weekly_outflow)
        if pct < -0.30 and commitments_unchanged:
            flags.append("possible_missing_costs_deferred_liabilities")
        if pct > 0.30:
            flags.append("overspend_or_hidden_liabilities")
    return flags
