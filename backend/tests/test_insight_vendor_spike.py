"""Vendor-spike generator: stable / first-month / spike / shrink."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.services.insights.vendor_spike import VendorHistory, detect_vendor_spend_spike


def _hist(merchant: str, monthly: list[tuple[str, str]], latest_ids: list[str] | None = None) -> VendorHistory:
    return VendorHistory(
        merchant=merchant,
        monthly_totals=[(date.fromisoformat(d), Decimal(a)) for d, a in monthly],
        latest_month_txn_ids=latest_ids or [],
    )


# ---------------------------------------------------------------------------
# Stable / no signal
# ---------------------------------------------------------------------------


def test_stable_vendor_emits_nothing():
    """Spend hovering around the average produces no insight."""
    out = detect_vendor_spend_spike(
        today=date(2026, 5, 16),
        vendor_history=[
            _hist(
                "AWS",
                [
                    ("2025-06-01", "1000"),
                    ("2025-07-01", "1010"),
                    ("2025-08-01", "990"),
                    ("2025-09-01", "1005"),
                    ("2025-10-01", "995"),
                    ("2025-11-01", "1000"),
                ],
            )
        ],
    )
    assert out == []


def test_first_month_vendor_skipped():
    """No average → no spike possible."""
    out = detect_vendor_spend_spike(
        today=date(2026, 5, 16),
        vendor_history=[
            _hist(
                "NewVendor",
                [
                    ("2026-05-01", "5000"),
                ],
            )
        ],
    )
    assert out == []


def test_below_min_baseline_amount_skipped():
    """Tiny baselines turn pct noise; ignore."""
    out = detect_vendor_spend_spike(
        today=date(2026, 5, 16),
        vendor_history=[
            _hist(
                "Coffee",
                [
                    ("2026-01-01", "5"),
                    ("2026-02-01", "6"),
                    ("2026-03-01", "5"),
                    ("2026-04-01", "5"),
                    ("2026-05-01", "20"),  # 300% jump but $20 isn't a story
                ],
            )
        ],
    )
    assert out == []


# ---------------------------------------------------------------------------
# Spikes
# ---------------------------------------------------------------------------


def test_clear_spike_fires_warn():
    """80% above trailing-12 avg: warn."""
    out = detect_vendor_spend_spike(
        today=date(2026, 5, 16),
        vendor_history=[
            _hist(
                "AWS",
                [
                    ("2025-06-01", "1000"),
                    ("2025-07-01", "1000"),
                    ("2025-08-01", "1000"),
                    ("2026-05-01", "1800"),
                ],
                latest_ids=["tx-a", "tx-b"],
            )
        ],
    )
    assert len(out) == 1
    assert out[0].severity == "warn"
    assert sorted(out[0].evidence_ids) == ["tx-a", "tx-b"]


def test_huge_spike_fires_critical():
    """3x is critical."""
    out = detect_vendor_spend_spike(
        today=date(2026, 5, 16),
        vendor_history=[
            _hist(
                "AWS",
                [
                    ("2025-06-01", "1000"),
                    ("2025-07-01", "1000"),
                    ("2025-08-01", "1000"),
                    ("2026-05-01", "3500"),
                ],
            )
        ],
    )
    assert len(out) == 1
    assert out[0].severity == "critical"


# ---------------------------------------------------------------------------
# Shrink (no insight; the spike check is one-sided)
# ---------------------------------------------------------------------------


def test_shrink_emits_nothing():
    """Vendor spend collapsing is not a spike; no fire."""
    out = detect_vendor_spend_spike(
        today=date(2026, 5, 16),
        vendor_history=[
            _hist(
                "AWS",
                [
                    ("2025-06-01", "5000"),
                    ("2025-07-01", "5000"),
                    ("2025-08-01", "5000"),
                    ("2026-05-01", "100"),
                ],
            )
        ],
    )
    assert out == []
