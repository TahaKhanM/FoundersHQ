"""Tests for commitment detection heuristics."""
from datetime import date, timedelta
from decimal import Decimal
import pytest
from app.services.spending.commitments import detect_commitments


def test_detect_commitments_weekly():
    # 4 txns roughly 7 days apart, similar amount
    base = date(2025, 1, 1)
    txns = [
        (base + timedelta(days=i * 7), Decimal("-100"), "Netflix")
        for i in range(4)
    ]
    out = detect_commitments(txns)
    assert len(out) >= 1
    assert any(c["merchant_canonical"] == "Netflix" for c in out)


def test_detect_commitments_insufficient_count():
    txns = [
        (date(2025, 1, 1), Decimal("-50"), "Once"),
        (date(2025, 1, 15), Decimal("-50"), "Once"),
    ]
    out = detect_commitments(txns)
    assert len(out) == 0


def test_detect_commitments_inflow_ignored():
    txns = [
        (date(2025, 1, 1) + timedelta(days=i * 7), Decimal("100"), "Salary")
        for i in range(4)
    ]
    out = detect_commitments(txns)
    assert len(out) == 0
