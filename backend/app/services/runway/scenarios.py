"""Runway scenario params: apply multiplier to base forecast."""
from decimal import Decimal
from typing import Any


def apply_scenario_params(
    base_weekly_outflows: dict,
    base_weekly_inflows: dict,
    params: dict[str, Any] | None,
) -> tuple[dict, dict]:
    if not params:
        return base_weekly_outflows, base_weekly_inflows
    allowed = {"outflows_multiplier", "inflows_multiplier"}
    if set(params) - allowed:
        raise ValueError("Supported scenario parameters: inflows_multiplier, outflows_multiplier")
    try:
        out_mult = Decimal(str(params.get("outflows_multiplier", 1)))
        in_mult = Decimal(str(params.get("inflows_multiplier", 1)))
    except (ValueError, ArithmeticError) as exc:
        raise ValueError("Scenario multipliers must be finite numbers between 0 and 10") from exc
    if any(not value.is_finite() or not 0 <= value <= 10 for value in (out_mult, in_mult)):
        raise ValueError("Scenario multipliers must be finite numbers between 0 and 10")
    new_out = {k: (v * out_mult).quantize(Decimal("0.0001")) for k, v in base_weekly_outflows.items()}
    new_in = {k: (v * in_mult).quantize(Decimal("0.0001")) for k, v in base_weekly_inflows.items()}
    return new_out, new_in
