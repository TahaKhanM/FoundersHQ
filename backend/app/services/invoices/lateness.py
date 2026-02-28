"""Invoice status inference and lateness fingerprint (deterministic)."""
from datetime import date
import statistics


def infer_status(due_date: date, paid_date: date | None, today: date | None = None) -> str:
    if paid_date is not None:
        return "paid"
    t = today or date.today()
    if t > due_date:
        return "overdue"
    return "open"


def lateness_fingerprint(
    paid_invoices: list[tuple[date, date]]
) -> dict:
    """
    paid_invoices: list of (due_date, paid_date).
    Returns: on_time_rate, median_delay, p90_delay, delay_days_list.
    """
    if not paid_invoices:
        return {"on_time_rate": 0.0, "median_delay": 0, "p90_delay": 0, "delay_days": []}
    delay_days = [max(0, (paid - due).days) for due, paid in paid_invoices]
    on_time = sum(1 for d in delay_days if d == 0)
    on_time_rate = on_time / len(delay_days)
    median_delay = int(statistics.median(delay_days))
    sorted_d = sorted(delay_days)
    idx = int(len(sorted_d) * 0.9) - 1
    p90_delay = sorted_d[min(idx, len(sorted_d) - 1)] if sorted_d else 0
    return {
        "on_time_rate": round(on_time_rate, 2),
        "median_delay": median_delay,
        "p90_delay": p90_delay,
        "delay_days": delay_days,
    }


def customer_lateness(
    by_customer: dict[str, list[tuple[date, date]]]
) -> dict[str, dict]:
    """Per-customer lateness fingerprint."""
    return {
        cid: lateness_fingerprint(pairs)
        for cid, pairs in by_customer.items()
    }
