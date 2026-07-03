"""Commitment-renewal generator: timing windows + threshold."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.services.insights.commitment_renewal import (
    CommitmentFact,
    detect_renewals_coming,
)


def _cmt(
    cid: str,
    next_due: str | None,
    amount: str = "1000",
    enabled: bool = True,
    frequency: str = "monthly",
) -> CommitmentFact:
    return CommitmentFact(
        commitment_id=cid,
        merchant_canonical=f"Vendor-{cid}",
        typical_amount=Decimal(amount),
        next_due_date=date.fromisoformat(next_due) if next_due else None,
        frequency=frequency,
        enabled=enabled,
    )


def test_inside_window_above_threshold_fires():
    out = detect_renewals_coming(
        today=date(2026, 5, 16),
        commitments=[_cmt("c-1", "2026-05-30", amount="2000")],
    )
    assert len(out) == 1
    assert out[0].evidence_ids == ["c-1"]
    assert out[0].severity == "warn"
    assert out[0].type == "commitment_renewal"


def test_outside_window_skipped():
    out = detect_renewals_coming(
        today=date(2026, 5, 16),
        commitments=[_cmt("c-far", "2026-07-30", amount="2000")],
    )
    assert out == []


def test_past_due_date_skipped():
    """Renewals only — past charges go in the audit, not the inbox."""
    out = detect_renewals_coming(
        today=date(2026, 5, 16),
        commitments=[_cmt("c-past", "2026-05-01", amount="2000")],
    )
    assert out == []


def test_below_threshold_skipped():
    """A $50/mo vendor doesn't deserve an insight every renewal."""
    out = detect_renewals_coming(
        today=date(2026, 5, 16),
        commitments=[_cmt("c-cheap", "2026-05-30", amount="50")],
    )
    assert out == []


def test_critical_above_high_threshold():
    out = detect_renewals_coming(
        today=date(2026, 5, 16),
        commitments=[_cmt("c-pricey", "2026-05-30", amount="9000")],
    )
    assert len(out) == 1
    assert out[0].severity == "critical"


def test_disabled_commitment_skipped():
    """A toggled-off commitment makes no sound."""
    out = detect_renewals_coming(
        today=date(2026, 5, 16),
        commitments=[_cmt("c-off", "2026-05-30", amount="9000", enabled=False)],
    )
    assert out == []


def test_no_next_due_date_skipped():
    """First-ever sighting with no inferred next charge: skip."""
    out = detect_renewals_coming(
        today=date(2026, 5, 16),
        commitments=[_cmt("c-no-date", None, amount="9000")],
    )
    assert out == []


def test_due_today_inside_window():
    """Day-of charges are inside the window."""
    out = detect_renewals_coming(
        today=date(2026, 5, 16),
        commitments=[_cmt("c-today", "2026-05-16", amount="1000")],
    )
    assert len(out) == 1


def test_output_sorted_by_commitment_id():
    """Stable order across runs → stable dedupe hash downstream."""
    out = detect_renewals_coming(
        today=date(2026, 5, 16),
        commitments=[
            _cmt("c-z", "2026-05-30", amount="1000"),
            _cmt("c-a", "2026-05-30", amount="1000"),
        ],
    )
    assert [i.evidence_ids[0] for i in out] == ["c-a", "c-z"]
