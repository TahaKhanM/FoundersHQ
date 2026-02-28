"""Tests for invoice predictions and lateness fingerprint."""
from datetime import date, timedelta
import pytest
from app.services.invoices.lateness import lateness_fingerprint, infer_status
from app.services.invoices.predictions import confidence_tier, expected_pay_dates


def test_infer_status():
    today = date(2025, 2, 1)
    assert infer_status(date(2025, 3, 1), None, today) == "open"
    assert infer_status(date(2025, 1, 1), None, today) == "overdue"
    assert infer_status(date(2025, 1, 1), date(2025, 1, 15), today) == "paid"


def test_lateness_fingerprint():
    paid = [
        (date(2025, 1, 1), date(2025, 1, 5)),   # 4 days late
        (date(2025, 1, 10), date(2025, 1, 10)), # on time
        (date(2025, 1, 20), date(2025, 2, 5)), # 16 days late
    ]
    fp = lateness_fingerprint(paid)
    assert fp["on_time_rate"] == 1/3
    assert fp["median_delay"] in (4, 16)
    assert fp["p90_delay"] >= 4


def test_confidence_tier():
    assert confidence_tier(10) == "high"
    assert confidence_tier(5) == "medium"
    assert confidence_tier(2) == "low"


def test_expected_pay_dates():
    due = date(2025, 2, 1)
    base, pess = expected_pay_dates(due, 5, 14)
    assert base == date(2025, 2, 6)
    assert pess == date(2025, 2, 15)
