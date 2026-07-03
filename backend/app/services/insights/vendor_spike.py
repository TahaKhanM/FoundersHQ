"""Vendor-spike generator.

Fires when a vendor's spend in the latest month is > 50% (configurable)
above the trailing-12-month average. Each finding cites the transactions
from the spike month so the user can see exactly what's new.

Pure function. The orchestrator pre-aggregates transactions into the
``VendorHistory`` shape so the generator stays unaware of SQL.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from app.services.insights import InsightCandidate


@dataclass(frozen=True)
class VendorHistory:
    """Pre-aggregated vendor spend timeline.

    Attributes
    ----------
    merchant:
        Canonical merchant name (the dedupe target).
    monthly_totals:
        ``[(month_start, total_outflow), ...]`` chronologically ordered.
        The last entry is the latest (potentially spiking) month. The
        outflow is positive (the generator does not sign-flip).
    latest_month_txn_ids:
        Transaction ids that contributed to the latest month's outflow.
        Used as evidence — the user opens the inbox row and sees
        exactly which charges blew the budget.
    """

    merchant: str
    monthly_totals: list[tuple[date, Decimal]]
    latest_month_txn_ids: list[str] = field(default_factory=list)


def detect_vendor_spend_spike(
    today: date,
    vendor_history: list[VendorHistory],
    spike_threshold_pct: Decimal = Decimal("0.50"),
    min_baseline_months: int = 3,
    min_baseline_amount: Decimal = Decimal("100"),
) -> list[InsightCandidate]:
    """One :class:`InsightCandidate` per vendor whose latest month spiked.

    Parameters
    ----------
    today:
        Carried for signature symmetry with other generators.
    vendor_history:
        Pre-aggregated per-vendor timeline. The orchestrator filters out
        vendors that are clearly noise (one-off charges, refunds-only).
    spike_threshold_pct:
        ``0.50`` means "the latest month is at least 1.5x the
        trailing-12 average". Configurable so test cases can pin lower.
    min_baseline_months:
        Need at least this many baseline data points to call a spike.
        First-month vendors are skipped — there's no average to compare.
    min_baseline_amount:
        Below this average the relative percent becomes statistical noise
        ("doubled from $5 to $10" is not actionable). The threshold
        lives here so changes are visible in one place.
    """
    # Suppress "unused parameter" lint without dropping it from the signature.
    _ = today

    out: list[InsightCandidate] = []
    for v in vendor_history:
        if len(v.monthly_totals) < min_baseline_months + 1:
            # Need at least baseline + latest.
            continue

        baseline_rows = v.monthly_totals[:-1]
        latest_month, latest_amount = v.monthly_totals[-1]
        # Use full trailing-12 if we have it; otherwise everything before
        # the latest. We deliberately do not weight recent months more
        # heavily — a hard average is reproducible and the rule
        # behaves the same way no matter when the user clicks Run.
        trailing = baseline_rows[-12:]
        baseline_avg = sum((amount for _, amount in trailing), Decimal("0")) / Decimal(
            len(trailing)
        )

        if baseline_avg < min_baseline_amount:
            continue

        ratio = (latest_amount - baseline_avg) / baseline_avg
        if ratio < spike_threshold_pct:
            continue

        severity = _severity(ratio)
        out.append(
            InsightCandidate(
                type="vendor_spike",
                severity=severity,
                title=f"{v.merchant} spend up {_pct(ratio)} vs trailing-12 avg",
                body=(
                    f"{v.merchant}: {latest_amount:,.0f} in "
                    f"{latest_month.strftime('%b %Y')} vs an average of "
                    f"{baseline_avg:,.0f} over the prior "
                    f"{len(trailing)} month(s)."
                ),
                evidence_ids=sorted(v.latest_month_txn_ids),
                deep_link="/spending",
            )
        )
    return out


def _severity(ratio: Decimal) -> str:
    """Severity ladder against the trailing-12 average.

    Tuned so the most common "this matters" range (50–150% above baseline)
    surfaces as ``warn``. A 2x-or-more jump is ``critical`` — that level
    of step-change deserves immediate attention.
    """
    if ratio >= Decimal("2.0"):
        return "critical"
    if ratio >= Decimal("0.5"):
        return "warn"
    return "info"


def _pct(ratio: Decimal) -> str:
    return f"{int(ratio * 100)}%"
