"""Deterministic spending metrics from transactions. All numeric computations reproducible from stored data."""
from datetime import date, timedelta
from decimal import Decimal
from collections import defaultdict

from app.utils.dates import week_start
from app.utils.money import round_currency, safe_divide


def total_outflow(amounts: list[Decimal]) -> Decimal:
    """Sum of max(0, -amount) for outflow."""
    return sum(max(Decimal("0"), -a) for a in amounts)


def total_inflow(amounts: list[Decimal]) -> Decimal:
    """Sum of max(0, amount) for inflow."""
    return sum(max(Decimal("0"), a) for a in amounts)


def net_burn(outflow: Decimal, inflow: Decimal) -> Decimal:
    return round_currency(outflow - inflow)


def run_rate_outflow(total_outflow_period: Decimal, period_days: int) -> Decimal:
    """Monthlyised outflow: TotalOutflow(Nd) * (30/N)."""
    if period_days <= 0:
        return Decimal("0")
    return round_currency(total_outflow_period * Decimal(30) / Decimal(period_days))


def run_rate_net_burn(net_burn_period: Decimal, period_days: int) -> Decimal:
    if period_days <= 0:
        return Decimal("0")
    return round_currency(net_burn_period * Decimal(30) / Decimal(period_days))


def spend_creep_pct(
    baseline_weekly_outflow: Decimal,
    current_weekly_outflow: Decimal,
) -> float | None:
    """(Current - Baseline) / Baseline. Returns None if baseline is 0."""
    if baseline_weekly_outflow is None or baseline_weekly_outflow == 0:
        return None
    return float((current_weekly_outflow - baseline_weekly_outflow) / baseline_weekly_outflow)


def cash_weeks(cash_balance: Decimal, weekly_net_burn: Decimal) -> tuple[float | None, str | None]:
    """Cash weeks = cash_balance / weekly_net_burn. Flag: 'infinite' if burn<=0 else None."""
    if weekly_net_burn is None or weekly_net_burn <= 0:
        return None, "infinite"
    try:
        weeks = float(cash_balance / weekly_net_burn)
        if weeks < 0:
            return None, "na"
        return round(weeks, 1), None
    except Exception:
        return None, "na"


def buffer_ratio(
    cash_balance: Decimal,
    monthly_fixed_commitments: Decimal,
) -> float | None:
    """cash_balance / monthly_fixed_commitments. None if commitments is 0."""
    v = safe_divide(cash_balance, monthly_fixed_commitments)
    return float(v) if v is not None else None


def revenue_breakeven_gap(net_burn_monthly_run_rate: Decimal) -> Decimal:
    """Gap = NetBurn monthly run rate (no revenue proxy in MVP)."""
    return round_currency(net_burn_monthly_run_rate)


def compute_baseline_weekly_outflow(
    weekly_outflows: list[Decimal],
    exclude_last_n: int = 1,
) -> Decimal:
    """Mean of weekly outflows for prior weeks, excluding last N."""
    if not weekly_outflows or len(weekly_outflows) <= exclude_last_n:
        return Decimal("0")
    subset = weekly_outflows[:-exclude_last_n]
    return sum(subset) / len(subset)


def compute_weekly_outflows_by_week(
    txn_dates_and_amounts: list[tuple[date, Decimal]],
    reference_end: date,
    num_weeks: int = 9,
) -> dict[date, Decimal]:
    """Bucket outflow (max(0,-amount)) by week_start. Returns dict week_start -> total outflow."""
    outflows_by_week: dict[date, Decimal] = defaultdict(Decimal)
    for d, amt in txn_dates_and_amounts:
        ws = week_start(d)
        outflows_by_week[ws] += max(Decimal("0"), -amt)
    return dict(outflows_by_week)


def reconcile_weekly_to_period(
    weekly_outflow_series: list[tuple[date, Decimal]],
    period_outflow_total: Decimal,
    epsilon: Decimal = Decimal("0.01"),
) -> tuple[bool, Decimal]:
    """Return (mismatch, sum_of_weekly_totals). Mismatch if |sum_weekly - period| > epsilon."""
    sum_weekly = sum(w[1] for w in weekly_outflow_series)
    mismatch = abs(sum_weekly - period_outflow_total) > epsilon
    return mismatch, sum_weekly


def vendor_anomaly_mad(weekly_spend_by_merchant: dict[str, list[Decimal]]) -> dict[str, bool]:
    """Simple MAD-based anomaly: True if merchant's last week is outlier. Placeholder returns {}."""
    # MVP: could compute median and MAD per merchant, flag if last > median + k*MAD
    return {}
