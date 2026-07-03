"""Invoice pay date predictions: expected_base = due + median_delay, expected_pess = due + p90. Confidence tier from count."""
from datetime import date


def confidence_tier(paid_count: int) -> str:
    """high >= 10, medium 3-9, low < 3."""
    if paid_count >= 10:
        return "high"
    if paid_count >= 3:
        return "medium"
    return "low"


def expected_pay_dates(due_date: date, median_delay_days: int, p90_delay_days: int) -> tuple[date, date]:
    from datetime import timedelta
    base = due_date + timedelta(days=median_delay_days)
    pess = due_date + timedelta(days=p90_delay_days)
    return base, pess
