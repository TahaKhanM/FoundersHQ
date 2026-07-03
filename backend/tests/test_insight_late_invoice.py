"""Late-invoice generator: same-day, weekend, paid, multiple."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.services.insights.late_invoice import InvoiceFact, detect_newly_late


def _inv(
    invoice_id: str,
    due: str,
    amount: str = "2000",
    status: str = "open",
    name: str = "ACME",
) -> InvoiceFact:
    return InvoiceFact(
        invoice_id=invoice_id,
        due_date=date.fromisoformat(due),
        amount=Decimal(amount),
        status=status,
        customer_name=name,
    )


def test_due_today_inside_window_fires():
    """An invoice whose due_date == today is just now late."""
    out = detect_newly_late(
        today=date(2026, 5, 16),
        invoices=[_inv("inv-1", "2026-05-16")],
        last_run=date(2026, 5, 15),
    )
    assert len(out) == 1
    assert out[0].evidence_ids == ["inv-1"]
    assert out[0].type == "late_invoice"


def test_already_overdue_before_window_does_not_fire():
    """Stale overdue invoices are surfaced elsewhere, not by this insight."""
    out = detect_newly_late(
        today=date(2026, 5, 16),
        invoices=[_inv("inv-old", "2026-01-01", status="overdue")],
        last_run=date(2026, 5, 15),
    )
    assert out == []


def test_paid_invoice_skipped():
    """We do not nag about invoices the customer already paid."""
    out = detect_newly_late(
        today=date(2026, 5, 16),
        invoices=[_inv("inv-paid", "2026-05-15", status="paid")],
        last_run=date(2026, 5, 14),
    )
    assert out == []


def test_future_due_date_skipped():
    """An invoice due tomorrow is not yet late."""
    out = detect_newly_late(
        today=date(2026, 5, 16),
        invoices=[_inv("inv-future", "2026-05-17")],
        last_run=date(2026, 5, 15),
    )
    assert out == []


def test_multiple_invoices_emit_multiple_findings():
    """One insight per invoice, in input order (stable for tests)."""
    out = detect_newly_late(
        today=date(2026, 5, 16),
        invoices=[
            _inv("inv-a", "2026-05-15"),
            _inv("inv-b", "2026-05-16"),
        ],
        last_run=date(2026, 5, 14),
    )
    assert len(out) == 2
    assert sorted(i.evidence_ids[0] for i in out) == ["inv-a", "inv-b"]


def test_severity_scales_with_amount():
    """Big-ticket invoices are critical; small ones info."""
    out = detect_newly_late(
        today=date(2026, 5, 16),
        invoices=[
            _inv("big", "2026-05-16", amount="60000"),
            _inv("mid", "2026-05-16", amount="10000"),
            _inv("small", "2026-05-16", amount="100"),
        ],
        last_run=date(2026, 5, 15),
    )
    by_id = {i.evidence_ids[0]: i for i in out}
    assert by_id["big"].severity == "critical"
    assert by_id["mid"].severity == "warn"
    assert by_id["small"].severity == "info"


def test_weekend_due_date_in_window_fires():
    """Crossed late over a weekend (last_run was Friday, today is Monday)."""
    out = detect_newly_late(
        today=date(2026, 5, 18),  # Monday
        invoices=[_inv("inv-sat", "2026-05-16")],  # Saturday
        last_run=date(2026, 5, 15),  # Friday
    )
    assert len(out) == 1
    assert out[0].evidence_ids == ["inv-sat"]


def test_inverted_window_returns_empty():
    """Defensive: last_run > today produces no insights, no exception."""
    out = detect_newly_late(
        today=date(2026, 5, 16),
        invoices=[_inv("inv", "2026-05-16")],
        last_run=date(2026, 5, 20),
    )
    assert out == []
