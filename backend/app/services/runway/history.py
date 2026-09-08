"""An explicit historical cash-flow baseline, with no invoice double counting."""
from datetime import date, timedelta
from decimal import Decimal

from app.utils.dates import week_start

LOOKBACK_WEEKS = 8
PRECISION = Decimal("0.0001")


def historical_weekly_flows(
    transactions: list[tuple[date, Decimal]], as_of: date,
) -> tuple[Decimal, Decimal]:
    """Average over eight complete calendar weeks, including weeks with no activity.

    Positive amounts are receipts and negative amounts are payments. The current
    incomplete week and future transactions cannot influence the projection.
    """
    end = week_start(as_of)
    start = end - timedelta(weeks=LOOKBACK_WEEKS)
    amounts = [amount for day, amount in transactions if start <= day < end]
    if not amounts:
        raise ValueError("At least one transaction in the previous eight complete weeks is required")
    if any(not amount.is_finite() for amount in amounts):
        raise ValueError("Transaction amounts must be finite")
    inflows = sum((a for a in amounts if a > 0), Decimal(0))
    outflows = -sum((a for a in amounts if a < 0), Decimal(0))
    return ((inflows / LOOKBACK_WEEKS).quantize(PRECISION),
            (outflows / LOOKBACK_WEEKS).quantize(PRECISION))
