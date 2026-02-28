"""Runway forecast: weekly buckets, cash simulation, crash week. Deterministic."""
from datetime import date, timedelta
from decimal import Decimal
from collections import defaultdict

from app.utils.dates import week_start, iter_week_starts


def run_forecast(
    cash_start: Decimal,
    horizon_weeks: int,
    weekly_inflows: dict[date, Decimal],
    weekly_outflows: dict[date, Decimal],
    start_date: date,
) -> tuple[list[dict], int | None, int | None]:
    """
    weekly_inflows / weekly_outflows: week_start -> amount.
    Returns: rows, crash_week_base, crash_week_pess.
    """
    rows = []
    cash = cash_start
    crash_base: int | None = None
    crash_pess: int | None = None
    for i, ws in enumerate(iter_week_starts(start_date, horizon_weeks)):
        inf = weekly_inflows.get(ws, Decimal("0"))
        out = weekly_outflows.get(ws, Decimal("0"))
        start_cash = cash
        cash = cash + inf - out
        row = {
            "week_start": ws,
            "starting_cash": start_cash,
            "inflows": inf,
            "outflows": out,
            "ending_cash": cash,
            "flags": [],
            "evidence_ids": [],
        }
        if cash < 0 and crash_base is None:
            crash_base = i
        if cash < 0 and crash_pess is None:
            crash_pess = i
        rows.append(row)
    return rows, crash_base, crash_pess


def cash_weeks_from_forecast(rows: list[dict], crash_week_index: int | None) -> float | None:
    if crash_week_index is None:
        return None
    return float(crash_week_index)
