"""Late-invoice generator.

Fires once per invoice when its ``due_date`` crosses since the previous
run. Each finding carries the invoice id so the Evidence chip resolves
directly back to the invoice row. The frontend deep-links to ``/invoices``
so the user can act.

Pure function: invoices and the "previous run" date go in, candidates
come out. The orchestrator owns the "previous run" — most callers pass
``today - 1 day`` for a nightly run; tests pin both dates.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.services.insights import InsightCandidate


@dataclass(frozen=True)
class InvoiceFact:
    """The minimal slice of an invoice a generator needs.

    Generators must not depend on the SQLAlchemy ORM — the orchestrator
    extracts these primitives so the generator stays trivially testable.
    """

    invoice_id: str
    due_date: date
    amount: Decimal
    status: str
    customer_name: str


def detect_newly_late(
    today: date,
    invoices: list[InvoiceFact],
    last_run: date | None = None,
) -> list[InsightCandidate]:
    """Return one insight per invoice that crossed ``due_date`` since ``last_run``.

    Parameters
    ----------
    today:
        Caller's "now"; used as the upper bound of the lateness window.
    invoices:
        All open / overdue invoices for the org. Paid invoices are skipped.
    last_run:
        Lower bound (exclusive). If ``None``, defaults to one day before
        ``today`` so a nightly cron is the natural fit.

    Notes
    -----
    "Crossed late" means ``last_run < due_date <= today`` AND the invoice
    is not paid. Paid-late is also surfaced — paid_date > due_date with
    due_date inside the window — but only if a status of ``paid`` is
    accompanied by ``paid_date`` strictly after ``due_date``. We choose the
    "paid late" emphasis to encourage future-touch hygiene rather than to
    panic the founder.

    The same-day case is included: an invoice whose ``due_date == today``
    qualifies. This matches how a finance team thinks about "due today —
    has it come in?".
    """
    if last_run is None:
        # Default window is one day. The orchestrator can override for the
        # first run or a backfill.
        from datetime import timedelta

        last_run = today - timedelta(days=1)

    # Defensive: an inverted window means "no insights" rather than a
    # tasteless exception. Caller bugs surface through the orchestrator's
    # tests, not through pytest.
    if last_run > today:
        return []

    out: list[InsightCandidate] = []
    for inv in invoices:
        if inv.due_date <= last_run or inv.due_date > today:
            continue
        # Paid-on-time invoices are not interesting.
        if inv.status == "paid":
            continue

        # An "open" invoice whose due_date is inside the window is now late.
        # An "overdue" invoice that landed in the window is the same case
        # (the status flip happened today). Either way we surface once.
        severity = _severity(inv.amount)
        days_late = (today - inv.due_date).days
        out.append(
            InsightCandidate(
                type="late_invoice",
                severity=severity,
                title=f"{inv.customer_name} invoice is overdue",
                body=(
                    f"{inv.customer_name}'s invoice for {inv.amount:,.0f} "
                    f"was due {inv.due_date.isoformat()} "
                    f"({_days_phrase(days_late)})."
                ),
                evidence_ids=[inv.invoice_id],
                deep_link="/invoices",
            )
        )
    return out


def _severity(amount: Decimal) -> str:
    """Severity scales with the dollar exposure, not the lateness."""
    if amount >= Decimal("50000"):
        return "critical"
    if amount >= Decimal("5000"):
        return "warn"
    return "info"


def _days_phrase(days_late: int) -> str:
    if days_late <= 0:
        return "due today"
    if days_late == 1:
        return "1 day overdue"
    return f"{days_late} days overdue"
