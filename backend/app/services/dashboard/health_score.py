"""Deterministic health score: weights sum to 100%. All from stored data."""
from decimal import Decimal


def clip(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


# Weights (must sum to 1.0)
W_RUNWAY = 0.35
W_BURN = 0.25
W_INVOICE = 0.20
W_CONC = 0.10
W_COMMIT = 0.05
W_FUND = 0.05


def s_runway(cash_weeks: float | None) -> float:
    """0-100: 26+ weeks = 100, 0 = 0, linear."""
    if cash_weeks is None or cash_weeks < 0:
        return 0.0
    if cash_weeks >= 26:
        return 100.0
    return clip(float(cash_weeks) / 26.0 * 100.0, 0, 100)


def s_burn(run_rate_stable: bool, has_90d_data: bool) -> float:
    """0-100: stable burn + has data = 100."""
    if not has_90d_data:
        return 50.0
    return 100.0 if run_rate_stable else 70.0


def s_invoice(on_time_ratio: float | None) -> float:
    """0-100: on_time_ratio (paid on time / total paid)."""
    if on_time_ratio is None:
        return 50.0
    return clip(on_time_ratio * 100.0, 0, 100)


def s_conc(concentration_risk: float) -> float:
    """0-100: 100 - concentration risk (0-1)."""
    return clip(100.0 - concentration_risk * 100.0, 0, 100)


def s_commit(has_commitments: bool, enabled_count: int) -> float:
    """0-100: has data and some enabled."""
    if not has_commitments:
        return 50.0
    return 100.0 if enabled_count > 0 else 30.0


def s_fund(opportunity_count: int) -> float:
    """0-100: placeholder."""
    if opportunity_count >= 5:
        return 80.0
    if opportunity_count >= 1:
        return 60.0
    return 40.0


def compute_health_score(
    cash_weeks: float | None,
    run_rate_stable: bool,
    has_90d_data: bool,
    on_time_ratio: float | None,
    concentration_risk: float,
    has_commitments: bool,
    commitment_enabled_count: int,
    funding_opportunity_count: int,
) -> tuple[float, list[tuple[str, str, float, float]]]:
    """
    Returns (score, breakdown).
    breakdown: list of (key, label, value, weightPct).
    """
    sr = s_runway(cash_weeks)
    sb = s_burn(run_rate_stable, has_90d_data)
    si = s_invoice(on_time_ratio)
    sc = s_conc(concentration_risk)
    scomm = s_commit(has_commitments, commitment_enabled_count)
    sf = s_fund(funding_opportunity_count)
    score = clip(
        W_RUNWAY * sr + W_BURN * sb + W_INVOICE * si + W_CONC * sc + W_COMMIT * scomm + W_FUND * sf,
        0, 100,
    )
    breakdown = [
        ("runway", "Runway", round(sr, 1), W_RUNWAY * 100),
        ("burn", "Burn rate", round(sb, 1), W_BURN * 100),
        ("invoice", "Invoice on-time", round(si, 1), W_INVOICE * 100),
        ("concentration", "Concentration", round(sc, 1), W_CONC * 100),
        ("commitments", "Commitments", round(scomm, 1), W_COMMIT * 100),
        ("funding", "Funding", round(sf, 1), W_FUND * 100),
    ]
    return round(score, 1), breakdown
