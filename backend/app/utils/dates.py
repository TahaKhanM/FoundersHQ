"""Date helpers for periods and buckets."""
from datetime import date, timedelta
from typing import Iterator


def period_30d_end(reference: date) -> date:
    return reference - timedelta(days=30)


def period_90d_end(reference: date) -> date:
    return reference - timedelta(days=90)


def week_start(d: date) -> date:
    """Monday of the week containing d."""
    return d - timedelta(days=d.weekday())


def weeks_between(start: date, end: date) -> int:
    """Number of full weeks (Monday-based) between start and end (inclusive)."""
    ws = week_start(start)
    we = week_start(end)
    return max(0, (we - ws).days // 7 + 1)


def iter_week_starts(start: date, num_weeks: int) -> Iterator[date]:
    """Yield week_start dates for num_weeks starting from week of start."""
    cur = week_start(start)
    for _ in range(num_weeks):
        yield cur
        cur += timedelta(days=7)
