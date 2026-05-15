"""Cash-drop generator: stable / spike / cliff / edge."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.services.insights.cash_drop import detect_cash_drop


def _hist(*entries: tuple[str, str]) -> list[tuple[date, Decimal]]:
    return [(date.fromisoformat(d), Decimal(amt)) for d, amt in entries]


# ---------------------------------------------------------------------------
# Happy paths and severity bands
# ---------------------------------------------------------------------------


def test_stable_history_emits_nothing():
    """Two equal-ish weeks: no insight."""
    out = detect_cash_drop(
        today=date(2026, 5, 18),
        weekly_cash_history=_hist(
            ("2026-05-04", "100000"),
            ("2026-05-11", "98000"),
        ),
    )
    assert out == []


def test_drop_below_threshold_emits_nothing():
    """A 10% drop is below the 25% default threshold."""
    out = detect_cash_drop(
        today=date(2026, 5, 18),
        weekly_cash_history=_hist(
            ("2026-05-04", "100000"),
            ("2026-05-11", "90000"),
        ),
    )
    assert out == []


def test_drop_at_threshold_emits_warn():
    """Exactly 25% drop fires at warn severity."""
    out = detect_cash_drop(
        today=date(2026, 5, 18),
        weekly_cash_history=_hist(
            ("2026-05-04", "100000"),
            ("2026-05-11", "75000"),
        ),
    )
    assert len(out) == 1
    assert out[0].severity == "warn"
    assert out[0].type == "cash_drop"


def test_drop_at_critical_threshold_emits_critical():
    """50% drop is critical."""
    out = detect_cash_drop(
        today=date(2026, 5, 18),
        weekly_cash_history=_hist(
            ("2026-05-04", "100000"),
            ("2026-05-11", "40000"),
        ),
    )
    assert len(out) == 1
    assert out[0].severity == "critical"


# ---------------------------------------------------------------------------
# Edges
# ---------------------------------------------------------------------------


def test_less_than_two_weeks_history_emits_nothing():
    """No comparison possible with one or zero entries."""
    assert detect_cash_drop(today=date(2026, 5, 18), weekly_cash_history=[]) == []
    assert (
        detect_cash_drop(
            today=date(2026, 5, 18),
            weekly_cash_history=_hist(("2026-05-11", "100000")),
        )
        == []
    )


def test_cash_grew_emits_nothing():
    """A rise is good news; insights for that live on the rise side."""
    out = detect_cash_drop(
        today=date(2026, 5, 18),
        weekly_cash_history=_hist(
            ("2026-05-04", "100000"),
            ("2026-05-11", "120000"),
        ),
    )
    assert out == []


def test_zero_baseline_with_outflow_emits_critical():
    """Cash crossing zero is always worth surfacing."""
    out = detect_cash_drop(
        today=date(2026, 5, 18),
        weekly_cash_history=_hist(
            ("2026-05-04", "0"),
            ("2026-05-11", "-1000"),
        ),
    )
    assert len(out) == 1
    assert out[0].severity == "critical"


def test_evidence_sorted_by_outflow_desc():
    """Largest outflow first in evidence_ids."""
    out = detect_cash_drop(
        today=date(2026, 5, 18),
        weekly_cash_history=_hist(
            ("2026-05-04", "100000"),
            ("2026-05-11", "70000"),
        ),
        drop_transactions=[
            ("txn-small", Decimal("-100")),
            ("txn-big", Decimal("-5000")),
            ("txn-mid", Decimal("-1000")),
        ],
    )
    assert len(out) == 1
    assert out[0].evidence_ids[0] == "txn-big"
    assert out[0].evidence_ids[-1] == "txn-small"
