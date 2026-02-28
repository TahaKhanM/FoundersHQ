"""Commitment detection heuristics: group by merchant, interval clustering, stable amounts."""
from datetime import date, timedelta
from decimal import Decimal
from collections import defaultdict
import statistics

# Target intervals in days for frequency detection
TARGET_INTERVALS = {
    "weekly": 7,
    "biweekly": 14,
    "monthly": 30,
    "annual": 365,
}
TOLERANCE_PCT = 0.15  # ±15% amount stability
MIN_COUNT = 3


def detect_commitments(
    txn_list: list[tuple[date, Decimal, str]]
) -> list[dict]:
    """
    txn_list: list of (txn_date, amount, merchant_canonical).
    Returns list of commitment dicts: merchant_canonical, frequency, typical_amount, last_seen_date, next_due_date, confidence.
    """
    # Group by merchant (outflow only: negative amount)
    by_merchant: dict[str, list[tuple[date, Decimal]]] = defaultdict(list)
    for d, amt, merchant in txn_list:
        if merchant and amt < 0:
            by_merchant[merchant].append((d, amt))

    result = []
    for merchant, pairs in by_merchant.items():
        if len(pairs) < MIN_COUNT:
            continue
        pairs_sorted = sorted(pairs, key=lambda x: x[0])
        dates = [p[0] for p in pairs_sorted]
        amounts = [-p[1] for p in pairs_sorted]  # positive amounts

        # Intervals between consecutive dates
        intervals = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
        if not intervals:
            continue
        median_interval = statistics.median(intervals)
        median_amount = statistics.median(amounts)
        amount_std = statistics.stdev(amounts) if len(amounts) > 1 else Decimal("0")
        amount_cv = float(amount_std / median_amount) if median_amount else 1.0
        if amount_cv > TOLERANCE_PCT:
            continue  # too variable

        # Map median interval to frequency
        freq = "monthly"
        best_diff = abs(median_interval - 30)
        for f, days in TARGET_INTERVALS.items():
            if abs(median_interval - days) < best_diff:
                best_diff = abs(median_interval - days)
                freq = f

        last_seen = max(dates)
        next_due = last_seen + timedelta(days=int(median_interval))
        # Confidence from count and consistency
        interval_std = statistics.stdev(intervals) if len(intervals) > 1 else 0
        consistency = 1.0 - min(1.0, interval_std / (median_interval or 1) * 0.5)
        count_factor = min(1.0, (len(pairs) - MIN_COUNT) / 7 + 0.5)
        confidence = round(consistency * count_factor, 2)

        result.append({
            "merchant_canonical": merchant,
            "frequency": freq,
            "typical_amount": round_currency(Decimal(str(median_amount))),
            "currency": "USD",  # caller can set from txns
            "last_seen_date": last_seen,
            "next_due_date": next_due,
            "confidence": confidence,
        })
    return result


def round_currency(value: Decimal, places: int = 2) -> Decimal:
    return value.quantize(Decimal(10) ** -places)
