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
    out_mult = params.get("outflows_multiplier") or 1.0
    in_mult = params.get("inflows_multiplier") or 1.0
    new_out = {k: v * Decimal(str(out_mult)) for k, v in base_weekly_outflows.items()}
    new_in = {k: v * Decimal(str(in_mult)) for k, v in base_weekly_inflows.items()}
    return new_out, new_in
