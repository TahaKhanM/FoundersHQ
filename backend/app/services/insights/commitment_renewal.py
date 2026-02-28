"""Commitment-renewal generator.

Fires for each enabled commitment whose ``next_due_date`` falls within
``lookahead_days`` and whose ``typical_amount`` is above ``min_amount``.
Each finding carries the commitment id as evidence so the user can jump
to the commitment row and toggle or edit it.

Pure function. Inputs are :class:`CommitmentFact` records, the orchestrator
strips the ORM rows.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from app.services.insights import InsightCandidate


@dataclass(frozen=True)
class CommitmentFact:
    """Just enough for the generator to decide.

    Attributes
    ----------
    commitment_id:
        UUID of the commitment row — used as evidence.
    merchant_canonical:
        Display name in the title and body.
    typical_amount:
        Amount expected to charge (base currency). Used to suppress noise
        and to compute severity.
    next_due_date:
        First upcoming charge. ``None`` skips the row.
    frequency:
        Plain English label appended to the body (``monthly``, etc.).
    enabled:
        Disabled commitments produce no insights. The orchestrator could
        filter beforehand; keeping it explicit here doc-tests the rule.
    """

    commitment_id: str
    merchant_canonical: str
    typical_amount: Decimal
    next_due_date: date | None
    frequency: str
    enabled: bool


def detect_renewals_coming(
    today: date,
    commitments: list[CommitmentFact],
    lookahead_days: int = 30,
    min_amount: Decimal = Decimal("500"),
    critical_amount: Decimal = Decimal("5000"),
) -> list[InsightCandidate]:
    """Find commitments whose next charge is inside the lookahead window.

    Parameters
    ----------
    today:
        Anchor date for the lookahead window.
    commitments:
        All commitments for the org. Disabled / past-due rows are skipped.
    lookahead_days:
        Window size, in days from ``today``. ``30`` is one calendar-ish
        month; the founder sees the upcoming month at every nightly run.
    min_amount:
        Threshold for "worth flagging" — a $9/month SaaS subscription
        does not need an insight every time it renews.
    critical_amount:
        At or above this, severity is critical (the renewal moves runway).

    Returns
    -------
    list[InsightCandidate]
        One per qualifying commitment, sorted by ``next_due_date`` then by
        ``commitment_id`` so the dedupe hash is stable across re-runs.
    """
    if lookahead_days < 0:
        return []
    window_end = today + timedelta(days=lookahead_days)

    candidates: list[InsightCandidate] = []
    for c in commitments:
        if not c.enabled:
            continue
        if c.next_due_date is None:
            continue
        if c.next_due_date < today or c.next_due_date > window_end:
            continue
        if c.typical_amount < min_amount:
            continue

        severity = "critical" if c.typical_amount >= critical_amount else "warn"
        days_out = (c.next_due_date - today).days
        candidates.append(
            InsightCandidate(
                type="commitment_renewal",
                severity=severity,
                title=f"{c.merchant_canonical} {c.frequency} renewal in {_days_phrase(days_out)}",
                body=(
                    f"{c.merchant_canonical} ({c.frequency}) is due to "
                    f"charge {c.typical_amount:,.0f} on "
                    f"{c.next_due_date.isoformat()}."
                ),
                evidence_ids=[c.commitment_id],
                deep_link="/spending",
            )
        )

    # Stable sort for reproducible dedupe hashes downstream.
    candidates.sort(key=lambda i: (i.evidence_ids[0],))
    return candidates


def _days_phrase(days_out: int) -> str:
    if days_out <= 0:
        return "today"
    if days_out == 1:
        return "1 day"
    return f"{days_out} days"
