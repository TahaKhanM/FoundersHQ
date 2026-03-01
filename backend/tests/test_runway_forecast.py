"""Tests for runway forecast simulation."""
from datetime import date, timedelta
from decimal import Decimal

from app.services.runway.forecast import run_forecast
from app.utils.dates import week_start


def test_week_start():
    assert week_start(date(2025, 2, 5)) == date(2025, 2, 3)  # Wednesday -> Monday


def test_run_forecast_basic():
    start = date(2025, 2, 3)
    horizon = 4
    inflows = {start + timedelta(days=7*i): Decimal("0") for i in range(horizon)}
    outflows = {start + timedelta(days=7*i): Decimal("1000") for i in range(horizon)}
    rows, crash_base, crash_pess = run_forecast(Decimal("2500"), horizon, inflows, outflows, start)
    assert len(rows) == 4
    assert rows[0]["starting_cash"] == Decimal("2500")
    assert rows[0]["ending_cash"] == Decimal("1500")
    assert rows[2]["ending_cash"] == Decimal("-500")
    assert crash_base == 2
    assert crash_pess == 2


def test_run_forecast_no_crash():
    start = date(2025, 2, 3)
    horizon = 2
    inflows = {start + timedelta(days=7*i): Decimal("2000") for i in range(horizon)}
    outflows = {start + timedelta(days=7*i): Decimal("1000") for i in range(horizon)}
    rows, crash_base, crash_pess = run_forecast(Decimal("5000"), horizon, inflows, outflows, start)
    assert crash_base is None
    assert crash_pess is None
    # 5000 + (2000 - 1000) net = 6000 after week 0, then + 1000 = 7000 after week 1
    assert rows[0]["ending_cash"] == Decimal("6000")
    assert rows[1]["ending_cash"] == Decimal("7000")
