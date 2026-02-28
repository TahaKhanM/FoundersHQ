"""Money and decimal helpers; no currency conversion in MVP."""
from decimal import Decimal, ROUND_HALF_UP


def round_currency(value: Decimal, places: int = 2) -> Decimal:
    return value.quantize(Decimal(10) ** -places, rounding=ROUND_HALF_UP)


def safe_divide(num: Decimal, denom: Decimal, default: Decimal | None = None) -> Decimal | None:
    if denom is None or denom == 0:
        return default
    return num / denom
