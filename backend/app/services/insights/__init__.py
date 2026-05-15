"""Deterministic insight generators + orchestrator.

Every generator is a **pure function** taking explicit facts plus
``today: date`` (callers default it; tests pin it). Each returns a list of
:class:`InsightCandidate` dataclasses. The orchestrator
(:mod:`run_all`) loads facts, calls each generator, dedupes by
``(org_id, type, sha256(sorted(evidence_ids)))``, persists, audits, and
publishes ``insight.created`` via the in-process event queue.

Generators must never read the clock or hit the DB. That guarantees the
output is reproducible from inputs and trivially testable in milliseconds.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field


@dataclass(frozen=True)
class InsightCandidate:
    """One generator output. The orchestrator turns it into an ``Insight`` row.

    Attributes
    ----------
    type:
        Generator key (``cash_drop``, ``late_invoice``, ``vendor_spike``,
        ``commitment_renewal``, ``runway_change``).
    severity:
        ``info`` | ``warn`` | ``critical``. Computed from the facts inside
        the generator. **Never** from an LLM.
    title:
        One-line headline shown in the inbox row.
    body:
        Short paragraph (≤ 280 chars) with the specific numbers. Numbers are
        formatted server-side from ``Decimal`` so the frontend reads them
        verbatim.
    evidence_ids:
        Sorted list of transaction/invoice/commitment UUIDs that drive the
        insight. The Evidence chip resolves these. ``[]`` only when the
        finding is a pure-aggregate where individual rows are not the
        explanation (e.g. runway-change attribution uses week-bucket ids).
    deep_link:
        Path the user lands on when clicking the inbox row.
    """

    type: str
    severity: str
    title: str
    body: str
    evidence_ids: list[str] = field(default_factory=list)
    deep_link: str | None = None


def evidence_hash(evidence_ids: list[str]) -> str:
    """sha256 over comma-joined sorted ids. Dedupe key for the orchestrator.

    Sorting first guarantees commutativity: ``[a, b] == [b, a]``. We use a
    comma separator (not the empty string) so a list of two ids that happen
    to concatenate to the same byte string as a single id can never collide.
    """
    canonical = ",".join(sorted(evidence_ids))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


__all__ = ["InsightCandidate", "evidence_hash"]
