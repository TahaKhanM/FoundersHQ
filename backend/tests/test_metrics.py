"""Tests for deterministic spending metrics."""
from decimal import Decimal
import pytest
from app.services.spending.metrics import (
    total_outflow,
    total_inflow,
    net_burn,
    run_rate_outflow,
    run_rate_net_burn,
    spend_creep_pct,
    cash_weeks,
    buffer_ratio,
    revenue_breakeven_gap,
    compute_baseline_weekly_outflow,
)


def test_total_outflow():
    assert total_outflow([Decimal("-100"), Decimal("50"), Decimal("-200")]) == Decimal("300")
    assert total_outflow([]) == Decimal("0")


def test_total_inflow():
    assert total_inflow([Decimal("-100"), Decimal("50"), Decimal("200")]) == Decimal("250")
    assert total_inflow([]) == Decimal("0")


def test_net_burn():
    assert net_burn(Decimal("1000"), Decimal("300")) == Decimal("700")
    assert net_burn(Decimal("500"), Decimal("500")) == Decimal("0")


def test_run_rate_outflow():
    assert run_rate_outflow(Decimal("9000"), 90) == Decimal("3000")  # 90d -> 30d
    assert run_rate_outflow(Decimal("0"), 30) == Decimal("0")


def test_run_rate_net_burn():
    assert run_rate_net_burn(Decimal("9000"), 90) == Decimal("3000")


def test_spend_creep_pct():
    assert spend_creep_pct(Decimal("100"), Decimal("125")) == 0.25
    assert spend_creep_pct(Decimal("100"), Decimal("100")) == 0
    assert spend_creep_pct(Decimal("0"), Decimal("100")) is None


def test_cash_weeks():
    cw, flag = cash_weeks(Decimal("10000"), Decimal("1000"))
    assert cw == 10.0
    assert flag is None
    cw2, flag2 = cash_weeks(Decimal("10000"), Decimal("0"))
    assert cw2 is None
    assert flag2 == "infinite"


def test_buffer_ratio():
    assert buffer_ratio(Decimal("10000"), Decimal("5000")) == 2.0
    assert buffer_ratio(Decimal("1000"), Decimal("0")) is None


def test_revenue_breakeven_gap():
    assert revenue_breakeven_gap(Decimal("5000")) == Decimal("5000.00")


def test_compute_baseline_weekly_outflow():
    weekly = [Decimal("100"), Decimal("200"), Decimal("300")]
    assert compute_baseline_weekly_outflow(weekly, exclude_last_n=1) == Decimal("150")  # mean of 100, 200
