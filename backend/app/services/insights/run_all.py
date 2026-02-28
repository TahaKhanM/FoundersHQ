"""Insight orchestrator.

Loads facts for one org, calls each pure-function generator, dedupes
against existing active insights using
``(org_id, type, sha256(sorted(evidence_ids)))``, persists new rows,
writes an audit row per insertion, and publishes ``insight.created`` via
the in-process event queue.

Generators never touch the DB. The orchestrator is the only seam where
SQL meets insights, which keeps every business rule reproducible from
plain Python inputs in tests.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.commitment import Commitment
from app.models.financial_profile import FinancialProfile
from app.models.insight import Insight
from app.models.invoice import Invoice
from app.models.runway import ForecastRow, RunwayForecast
from app.models.transaction import Transaction
from app.services.events import publish_event_best_effort
from app.services.insights import InsightCandidate, evidence_hash
from app.services.insights.cash_drop import detect_cash_drop
from app.services.insights.commitment_renewal import (
    CommitmentFact,
    detect_renewals_coming,
)
from app.services.insights.late_invoice import InvoiceFact, detect_newly_late
from app.services.insights.runway_change import (
    ForecastSnapshot,
    detect_runway_change,
)
from app.services.insights.vendor_spike import (
    VendorHistory,
    detect_vendor_spend_spike,
)
from app.utils.audit import record_audit

log = logging.getLogger(__name__)


def _month_start(d: date) -> date:
    """First-of-month bucket date for vendor spend timelines."""
    return d.replace(day=1)


async def _load_invoice_facts(
    session: AsyncSession, org_id: str
) -> list[InvoiceFact]:
    """Materialize invoices into pure facts for the late-invoice generator."""
    rows = (
        await session.execute(
            select(Invoice).where(
                Invoice.org_id == org_id,
                Invoice.status.in_(["open", "overdue", "paid"]),
            )
        )
    ).scalars().all()
    # Eager-load customer names without an N+1: build a single dict of
    # customer-name lookups instead of relying on lazy load.
    customer_ids = {r.customer_id for r in rows}
    if customer_ids:
        from app.models.invoice import Customer

        cust_rows = (
            await session.execute(
                select(Customer).where(Customer.id.in_(customer_ids))
            )
        ).scalars().all()
        names = {c.id: c.name_raw for c in cust_rows}
    else:
        names = {}
    facts: list[InvoiceFact] = []
    for r in rows:
        facts.append(
            InvoiceFact(
                invoice_id=r.id,
                due_date=r.due_date,
                amount=r.amount,
                status=r.status,
                customer_name=names.get(r.customer_id, "Customer"),
            )
        )
    return facts


async def _load_commitment_facts(
    session: AsyncSession, org_id: str
) -> list[CommitmentFact]:
    rows = (
        await session.execute(
            select(Commitment).where(Commitment.org_id == org_id)
        )
    ).scalars().all()
    return [
        CommitmentFact(
            commitment_id=r.id,
            merchant_canonical=r.merchant_canonical,
            typical_amount=r.typical_amount,
            next_due_date=r.next_due_date,
            frequency=r.frequency,
            enabled=r.enabled,
        )
        for r in rows
    ]


async def _load_vendor_history(
    session: AsyncSession, org_id: str, today: date
) -> list[VendorHistory]:
    """Bucket the last ~13 months of outflows by (merchant, month)."""
    # 13 months: 12 for the baseline plus the current month.
    cutoff = today - timedelta(days=400)
    rows = (
        await session.execute(
            select(Transaction).where(
                Transaction.org_id == org_id,
                Transaction.txn_date >= cutoff,
                Transaction.amount < 0,  # outflows only
            )
        )
    ).scalars().all()

    # vendor -> month -> (sum, list[ids])
    by_vendor: dict[str, dict[date, tuple[Decimal, list[str]]]] = defaultdict(
        lambda: defaultdict(lambda: (Decimal("0"), []))
    )
    latest_month = _month_start(today)
    for r in rows:
        vendor = (r.merchant_canonical or r.merchant_raw or "Unknown").strip()
        if not vendor:
            continue
        month = _month_start(r.txn_date)
        cur_sum, cur_ids = by_vendor[vendor][month]
        # Outflows are negative; report positive spend.
        by_vendor[vendor][month] = (
            cur_sum + (-r.amount),
            cur_ids + ([r.id] if month == latest_month else []),
        )

    histories: list[VendorHistory] = []
    for vendor, by_month in by_vendor.items():
        if not by_month:
            continue
        sorted_months = sorted(by_month.keys())
        monthly = [(m, by_month[m][0]) for m in sorted_months]
        # Latest-month transaction ids — empty when latest is missing.
        latest_ids = by_month.get(latest_month, (Decimal("0"), []))[1]
        histories.append(
            VendorHistory(
                merchant=vendor,
                monthly_totals=monthly,
                latest_month_txn_ids=latest_ids,
            )
        )
    return histories


async def _load_cash_history(
    session: AsyncSession, org_id: str, today: date
) -> tuple[list[tuple[date, Decimal]], list[tuple[str, Decimal]]]:
    """Build (week_start, ending_cash) tuples and last-week's tx list.

    We do not store true weekly snapshots in the MVP; we approximate the
    series by starting from the current cash_balance (from
    ``FinancialProfile``) and walking backwards using weekly net flows.
    That keeps the orchestrator reproducible from rows and avoids
    introducing a new "cash snapshots" table just for one insight.
    """
    profile = (
        await session.execute(
            select(FinancialProfile).where(FinancialProfile.org_id == org_id)
        )
    ).scalar_one_or_none()
    cash_balance = profile.cash_balance if profile and profile.cash_balance else None
    if cash_balance is None:
        return [], []

    from app.utils.dates import week_start

    txns = (
        await session.execute(
            select(Transaction).where(
                Transaction.org_id == org_id,
                Transaction.txn_date >= today - timedelta(days=21),
            )
        )
    ).scalars().all()
    # Aggregate by week.
    weekly_net: dict[date, Decimal] = defaultdict(Decimal)
    weekly_tx_ids: dict[date, list[tuple[str, Decimal]]] = defaultdict(list)
    for r in txns:
        ws = week_start(r.txn_date)
        weekly_net[ws] += r.amount
        weekly_tx_ids[ws].append((r.id, r.amount))

    weeks = sorted(weekly_net.keys())
    if not weeks:
        return [], []

    # End of week N's cash == cash_balance (today) when N == this week.
    # Walk back: end_of_week(N-1) = end_of_week(N) - net(N).
    history: list[tuple[date, Decimal]] = []
    rolling = cash_balance
    for ws in reversed(weeks):
        history.append((ws, rolling))
        rolling = rolling - weekly_net[ws]
    history.reverse()

    latest_ws = weeks[-1]
    drop_txns = [(tid, amt) for tid, amt in weekly_tx_ids[latest_ws] if amt < 0]
    return history, drop_txns


async def _load_prev_and_new_forecast(
    session: AsyncSession, org_id: str
) -> tuple[ForecastSnapshot | None, ForecastSnapshot | None]:
    """Return (previous, latest) forecast snapshots, both optional.

    We do not recompute the forecast here — we read whatever the runway
    cron has persisted. If there is only one snapshot the generator emits
    nothing on first-run; on the second nightly run we have two and the
    comparison fires.
    """
    rows = (
        await session.execute(
            select(RunwayForecast)
            .where(RunwayForecast.org_id == org_id)
            .order_by(RunwayForecast.generated_at.desc())
            .limit(2)
        )
    ).scalars().all()
    if not rows:
        return None, None

    latest = rows[0]
    prev = rows[1] if len(rows) >= 2 else None

    latest_attr = await _attribution_for_forecast(session, latest)
    prev_attr = (
        await _attribution_for_forecast(session, prev) if prev else []
    )

    latest_snap = ForecastSnapshot(
        generated_at=latest.generated_at.date(),
        cash_weeks_base=latest.cash_weeks_base,
        cash_weeks_pess=latest.cash_weeks_pess,
        attribution=latest_attr,
    )
    prev_snap = (
        ForecastSnapshot(
            generated_at=prev.generated_at.date(),
            cash_weeks_base=prev.cash_weeks_base,
            cash_weeks_pess=prev.cash_weeks_pess,
            attribution=prev_attr,
        )
        if prev
        else None
    )
    return prev_snap, latest_snap


async def _attribution_for_forecast(
    session: AsyncSession, forecast: RunwayForecast
) -> list[tuple[date, Decimal, list[str]]]:
    rows = (
        await session.execute(
            select(ForecastRow).where(ForecastRow.forecast_id == forecast.id)
        )
    ).scalars().all()
    out: list[tuple[date, Decimal, list[str]]] = []
    for r in rows:
        delta = r.inflows - r.outflows
        ids: list[str] = []
        if isinstance(r.evidence_ids, list):
            ids = [str(eid) for eid in r.evidence_ids]
        out.append((r.week_start, delta, ids))
    return out


async def _existing_dedupe_keys(
    session: AsyncSession, org_id: str
) -> set[tuple[str, str]]:
    """All ``(type, evidence_hash)`` tuples ever recorded for this org.

    Re-running the orchestrator must be a no-op when nothing changed —
    even when the user has dismissed yesterday's finding. Dedupe against
    **every** insight row (active or dismissed) keeps the inbox calm:
    once a user has seen something, they don't want it re-surfaced
    without the underlying evidence shifting.
    """
    rows = (
        await session.execute(
            select(Insight.type, Insight.evidence_hash).where(
                Insight.org_id == org_id,
            )
        )
    ).all()
    return {(t, h) for (t, h) in rows}


def _publish(insight: Insight) -> None:
    try:
        publish_event_best_effort(
            insight.org_id,
            "insight.created",
            {
                "id": insight.id,
                "org_id": insight.org_id,
                "type": insight.type,
                "severity": insight.severity,
                "title": insight.title,
                "body": insight.body,
                "evidence_ids": insight.evidence_ids or [],
                "deep_link": insight.deep_link,
            },
        )
    except Exception:  # noqa: BLE001
        # Publish failure must never roll back the DB transaction.
        log.exception("publish insight.created failed for %s", insight.id)


async def run_all(
    org_id: str,
    today: date,
    session: AsyncSession,
    *,
    last_run: date | None = None,
) -> list[Insight]:
    """Run every generator against the org's current facts.

    Returns the **newly-persisted** :class:`Insight` rows. Existing-and-
    matching insights are returned by the API list endpoint, not by this
    function — keeping the return type small makes downstream "did we
    create anything new?" checks trivial.

    Parameters
    ----------
    org_id:
        Target org.
    today:
        Caller-supplied. The router and the Celery task default it to
        ``date.today()``; tests pin it.
    session:
        Async SQLAlchemy session. The caller controls commit/rollback.
    last_run:
        Lower bound for the late-invoice window. Defaults to
        ``today - 1 day`` — adequate for a nightly cron.
    """
    # ----- Load facts (the only DB-touching block) -----
    invoices = await _load_invoice_facts(session, org_id)
    commitments = await _load_commitment_facts(session, org_id)
    vendor_history = await _load_vendor_history(session, org_id, today)
    cash_history, drop_txns = await _load_cash_history(session, org_id, today)
    prev_forecast, new_forecast = await _load_prev_and_new_forecast(
        session, org_id
    )

    # ----- Call generators -----
    candidates: list[InsightCandidate] = []
    candidates.extend(
        detect_cash_drop(
            today=today,
            weekly_cash_history=cash_history,
            drop_transactions=drop_txns,
        )
    )
    candidates.extend(
        detect_newly_late(today=today, invoices=invoices, last_run=last_run)
    )
    candidates.extend(
        detect_vendor_spend_spike(today=today, vendor_history=vendor_history)
    )
    candidates.extend(
        detect_renewals_coming(today=today, commitments=commitments)
    )
    if new_forecast is not None:
        candidates.extend(
            detect_runway_change(
                today=today,
                prev_forecast=prev_forecast,
                new_forecast=new_forecast,
            )
        )

    # ----- Dedupe + persist + audit + publish -----
    existing = await _existing_dedupe_keys(session, org_id)
    created: list[Insight] = []
    for cand in candidates:
        ehash = evidence_hash(cand.evidence_ids)
        key = (cand.type, ehash)
        if key in existing:
            continue
        existing.add(key)  # within-batch dedupe
        row = Insight(
            id=str(uuid4()),
            org_id=org_id,
            type=cand.type,
            severity=cand.severity,
            title=cand.title,
            body=cand.body,
            evidence_ids=cand.evidence_ids,
            evidence_hash=ehash,
            status="active",
            deep_link=cand.deep_link,
        )
        session.add(row)
        await session.flush()
        await record_audit(
            session,
            org_id=org_id,
            action="insight.created",
            entity_type="insight",
            entity_id=row.id,
            details={
                "type": row.type,
                "severity": row.severity,
                "evidence_count": len(cand.evidence_ids),
            },
        )
        _publish(row)
        created.append(row)
    return created
