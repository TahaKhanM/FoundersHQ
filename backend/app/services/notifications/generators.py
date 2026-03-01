"""Deterministic notification generators. Dedupe by (org_id, dedupe_key); no duplicate unread."""
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification

SEVERITY_ORDER = {"info": 0, "warning": 1, "critical": 2}


def _severity_rank(s: str) -> int:
    return SEVERITY_ORDER.get(s, 0)


def _dedupe(session: Session, org_id: str, dedupe_key: str, type_: str, severity: str, title: str, message: str, evidence_ids: list | None, deep_link: str | None, source: str | None) -> Notification | None:
    """Create or update notification; return the notification if created/updated, else None (skipped)."""
    existing = session.execute(
        select(Notification).where(
            Notification.org_id == org_id,
            Notification.dedupe_key == dedupe_key,
            Notification.read_at.is_(None),
        )
    ).scalar_one_or_none()
    if existing:
        if _severity_rank(severity) > _severity_rank(existing.severity):
            existing.severity = severity
            existing.title = title
            existing.message = message
            existing.evidence_ids = evidence_ids
            existing.deep_link = deep_link
            session.add(existing)
            return existing
        return None
    n = Notification(
        id=str(uuid4()),
        org_id=org_id,
        type=type_,
        severity=severity,
        title=title,
        message=message,
        evidence_ids=evidence_ids,
        deep_link=deep_link,
        dedupe_key=dedupe_key,
        source=source,
    )
    session.add(n)
    return n


def generate_spending_notifications(session: Session, org_id: str, spend_creep_pct: float | None, threshold: float = 0.25, evidence_ids: list | None = None, source: str | None = None) -> list[Notification]:
    """Spend creep alert as notification."""
    created = []
    if spend_creep_pct is None or spend_creep_pct < threshold:
        return created
    n = _dedupe(
        session, org_id,
        dedupe_key="spend_creep",
        type_="spending",
        severity="warning" if spend_creep_pct < 0.5 else "critical",
        title="Spend creep detected",
        message=f"Current week outflow is {spend_creep_pct:.0%} above baseline.",
        evidence_ids=evidence_ids or [],
        deep_link="/spending",
        source=source,
    )
    if n:
        created.append(n)
    return created


def generate_invoice_notifications(session: Session, org_id: str, overdue_count: int, overdue_sum: Decimal, open_count: int, source: str | None = None) -> list[Notification]:
    """Overdue / open invoice notifications."""
    created = []
    if overdue_count > 0:
        n = _dedupe(
            session, org_id,
            dedupe_key="invoices_overdue",
            type_="invoice",
            severity="critical" if overdue_count > 5 else "warning",
            title=f"{overdue_count} overdue invoice(s)",
            message=f"Total overdue: {overdue_sum} across {overdue_count} invoice(s).",
            evidence_ids=[],
            deep_link="/invoices",
            source=source,
        )
        if n:
            created.append(n)
    if open_count > 0 and overdue_count == 0:
        n = _dedupe(
            session, org_id,
            dedupe_key="invoices_open",
            type_="invoice",
            severity="info",
            title=f"{open_count} open invoice(s)",
            message="Review action queue.",
            evidence_ids=[],
            deep_link="/invoices",
            source=source,
        )
        if n:
            created.append(n)
    return created


def generate_runway_notifications(session: Session, org_id: str, cash_weeks: float | None, runway_threshold_weeks: float = 12, source: str | None = None) -> list[Notification]:
    """Low runway alert."""
    created = []
    if cash_weeks is not None and cash_weeks < runway_threshold_weeks and cash_weeks >= 0:
        severity = "critical" if cash_weeks < 4 else "warning"
        n = _dedupe(
            session, org_id,
            dedupe_key="runway_low",
            type_="runway",
            severity=severity,
            title="Low runway",
            message=f"Estimated runway: {cash_weeks:.1f} weeks.",
            evidence_ids=[],
            deep_link="/runway",
            source=source,
        )
        if n:
            created.append(n)
    return created


def generate_funding_notifications(session: Session, org_id: str, upcoming_deadline_count: int, source: str | None = None) -> list[Notification]:
    """Funding opportunities with upcoming deadlines."""
    created = []
    if upcoming_deadline_count > 0:
        n = _dedupe(
            session, org_id,
            dedupe_key="funding_deadlines",
            type_="funding",
            severity="info",
            title=f"{upcoming_deadline_count} funding opportunity(ies) with upcoming deadlines",
            message="Review timeline.",
            evidence_ids=[],
            deep_link="/funding",
            source=source,
        )
        if n:
            created.append(n)
    return created


def generate_system_notifications(session: Session, org_id: str, job_status: str, job_id: str, message: str, source: str | None = "celery") -> list[Notification]:
    """Job completion / failure notification."""
    dedupe_key = f"job_{job_id}"
    severity = "critical" if job_status == "failed" else "info"
    n = _dedupe(
        session, org_id,
        dedupe_key=dedupe_key,
        type_="system",
        severity=severity,
        title=f"Job {job_status}",
        message=message,
        evidence_ids=[],
        deep_link=None,
        source=source,
    )
    return [n] if n else []
