"""Cash-drop generator.

Fires when the latest week's ending cash dropped by more than the threshold
(default 25%) versus the prior week. Evidence is the transaction ids that
drove the drop — outflows from the latest week, largest first.

Pure function: takes a sorted weekly history and the driving transactions,
returns zero or one :class:`InsightCandidate`. No clocks, no DB.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.services.insights import InsightCandidate


def _format_money(value: Decimal) -> str:
    """Plain-English money: thousands separator, no currency symbol.

    The frontend renders the symbol via the ``<Money>`` component; the body
    text just states the number so it tracks the org's base currency.
    """
    return f"{value:,.0f}"


def detect_cash_drop(
    today: date,
    weekly_cash_history: list[tuple[date, Decimal]],
    drop_transactions: list[tuple[str, Decimal]] | None = None,
    threshold_pct: Decimal = Decimal("0.25"),
    severity_critical_pct: Decimal = Decimal("0.50"),
) -> list[InsightCandidate]:
    """Detect a >threshold drop in the latest weekly ending-cash datapoint.

    Parameters
    ----------
    today:
        Caller-supplied date. Generators never call the clock.
    weekly_cash_history:
        ``[(week_start, ending_cash), ...]`` ordered chronologically. We
        compare the last two entries. ``today`` is not consulted directly;
        it's kept on the signature so all generators share the same shape
        and the orchestrator can pass it uniformly.
    drop_transactions:
        ``[(txn_id, amount), ...]`` from the latest week, used as evidence.
        ``amount`` here is the signed transaction amount; outflows are
        negative. Largest absolute outflows go first in the evidence list.
        ``None`` is treated as no evidence available — the insight still
        fires (the body explains the drop) but with an empty ``evidence_ids``.
    threshold_pct:
        Minimum relative drop. ``0.25`` means a 25% week-over-week drop.
    severity_critical_pct:
        At-or-above this drop, the insight is ``critical``; below ``warn``.

    Returns
    -------
    list[InsightCandidate]
        Zero or one candidate. A list keeps the contract symmetric with the
        other generators, which may produce multiple findings per run.
    """
    if len(weekly_cash_history) < 2:
        return []

    prev_week, prev_cash = weekly_cash_history[-2]
    curr_week, curr_cash = weekly_cash_history[-1]

    # Cannot meaningfully compute % drop from a zero or negative baseline.
    # A baseline of zero with an outflow is "infinite drop" — surface that
    # as a critical insight regardless, because the founder needs to look.
    if prev_cash <= 0:
        if curr_cash < prev_cash:
            evidence_ids = _evidence_from_transactions(drop_transactions)
            return [
                InsightCandidate(
                    type="cash_drop",
                    severity="critical",
                    title="Cash balance crossed zero",
                    body=(
                        f"Ending cash fell from {_format_money(prev_cash)} "
                        f"to {_format_money(curr_cash)} in the week of "
                        f"{curr_week.isoformat()}."
                    ),
                    evidence_ids=evidence_ids,
                    deep_link="/runway",
                )
            ]
        return []

    delta = curr_cash - prev_cash
    if delta >= 0:
        return []
    # Decimal-safe relative drop. Sign-flipped so the threshold compares
    # against a positive ratio.
    ratio = (-delta) / prev_cash
    if ratio < threshold_pct:
        return []

    severity = "critical" if ratio >= severity_critical_pct else "warn"
    evidence_ids = _evidence_from_transactions(drop_transactions)
    return [
        InsightCandidate(
            type="cash_drop",
            severity=severity,
            title=f"Cash dropped {_pct(ratio)} week-over-week",
            body=(
                f"Ending cash fell from {_format_money(prev_cash)} to "
                f"{_format_money(curr_cash)} (week of "
                f"{curr_week.isoformat()}). Review the top outflows below."
            ),
            evidence_ids=evidence_ids,
            deep_link="/runway",
        )
    ]


def _evidence_from_transactions(
    drop_transactions: list[tuple[str, Decimal]] | None,
) -> list[str]:
    """Sort by absolute outflow descending and return ids only.

    Ties are broken by id so the result is stable across runs. This matters
    for the dedupe hash — same evidence in the same order means the same
    hash means a re-run is a no-op.
    """
    if not drop_transactions:
        return []
    # Outflows are negative; sort by abs(amount) desc, then id asc.
    sorted_rows = sorted(
        drop_transactions,
        key=lambda r: (-abs(r[1]), r[0]),
    )
    # Cap at the top 10 contributors. The user can drill in for more.
    return [txn_id for txn_id, _ in sorted_rows[:10]]


def _pct(ratio: Decimal) -> str:
    """Format a ratio like ``Decimal('0.27')`` as ``27%``."""
    return f"{int(ratio * 100)}%"
