"""Runway-change generator.

Fires when |new.cash_weeks - prev.cash_weeks| >= 4. The change can be in
either direction — a 4-week extension is just as interesting as a 4-week
contraction, since both alter board cadence. Evidence is the top-3
attribution rows by absolute delta.

Pure function. The orchestrator hands in two snapshots; tests pin them.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from app.services.insights import InsightCandidate


@dataclass(frozen=True)
class ForecastSnapshot:
    """The slice of a runway forecast the generator needs.

    Attributes
    ----------
    generated_at:
        Snapshot timestamp.
    cash_weeks_base:
        Base-case runway in weeks (``None`` if infinite/N-A).
    cash_weeks_pess:
        Pessimistic-case runway in weeks.
    attribution:
        ``[(week_start, delta, [txn_or_invoice_ids]), ...]`` sorted by
        absolute delta descending. Top-3 are used as evidence.
    """

    generated_at: date
    cash_weeks_base: float | None
    cash_weeks_pess: float | None
    attribution: list[tuple[date, Decimal, list[str]]] = field(default_factory=list)


def detect_runway_change(
    today: date,
    prev_forecast: ForecastSnapshot | None,
    new_forecast: ForecastSnapshot,
    threshold_weeks: float = 4.0,
) -> list[InsightCandidate]:
    """Compare two forecast snapshots and emit an insight on big shifts.

    Parameters
    ----------
    today:
        Carried for symmetry; not consulted directly.
    prev_forecast:
        Last persisted snapshot. ``None`` on the first ever run — the
        generator emits nothing so we don't spam "you have 26 weeks of
        runway" every Monday morning of week 1.
    new_forecast:
        Current snapshot, just computed by the orchestrator's caller.
    threshold_weeks:
        Minimum |delta| to fire. Default 4 weeks — roughly a month of
        runway is what matters at the founder cadence.

    Notes
    -----
    We compare the **base case** because that's the headline runway. The
    pessimistic case is included in the body for context but does not
    itself trigger the insight — otherwise we'd double-fire on
    parameter-only changes that don't actually move base.
    """
    _ = today
    if prev_forecast is None:
        return []
    if (
        prev_forecast.cash_weeks_base is None
        or new_forecast.cash_weeks_base is None
    ):
        # Can't compare against "infinite" or "N/A" — neither has a clear
        # business meaning for a runway-shift insight.
        return []

    delta = new_forecast.cash_weeks_base - prev_forecast.cash_weeks_base
    if abs(delta) < threshold_weeks:
        return []

    direction = "extended" if delta > 0 else "shortened"
    abs_delta = abs(delta)
    severity = _severity(abs_delta, delta)

    # Top-3 attribution rows by absolute weekly delta. Flatten the lists so
    # the evidence_ids field is a flat list of UUIDs.
    evidence_ids: list[str] = []
    seen: set[str] = set()
    for _wk, _dlt, ids in sorted(
        new_forecast.attribution, key=lambda r: -abs(r[1])
    )[:3]:
        for eid in ids:
            if eid not in seen:
                seen.add(eid)
                evidence_ids.append(eid)

    pess_phrase = ""
    if (
        prev_forecast.cash_weeks_pess is not None
        and new_forecast.cash_weeks_pess is not None
    ):
        pess_delta = new_forecast.cash_weeks_pess - prev_forecast.cash_weeks_pess
        pess_phrase = (
            f" Pessimistic case moved by {pess_delta:+.1f} weeks."
        )

    title = f"Runway {direction} by {abs_delta:.1f} weeks"
    body = (
        f"Base-case runway went from "
        f"{prev_forecast.cash_weeks_base:.1f} to "
        f"{new_forecast.cash_weeks_base:.1f} weeks since the last "
        f"snapshot on {prev_forecast.generated_at.isoformat()}."
        f"{pess_phrase}"
    )
    return [
        InsightCandidate(
            type="runway_change",
            severity=severity,
            title=title,
            body=body,
            evidence_ids=sorted(evidence_ids),
            deep_link="/runway",
        )
    ]


def _severity(abs_delta: float, signed_delta: float) -> str:
    """Big drops are critical; big gains are warn (still worth a look)."""
    if signed_delta < 0 and abs_delta >= 8:
        return "critical"
    if signed_delta < 0:
        return "warn"
    # Improvements are good news but worth surfacing as info.
    return "info"
