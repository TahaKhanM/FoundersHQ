"""Notifications inbox: snooze, preferences, SSE publish.

Covers Phase 1.C invariants:

- Snooze hides a notification from the Unread tab until ``snoozed_until`` elapses.
- Snooze options accept exactly the four discrete values (1h, 4h, 24h, monday).
- Preferences round-trip per-user, per-type, and persist across calls.
- Every mutation writes an audit row and publishes the matching event.
- Creating a notification via the generators publishes ``notification.created``.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.services.events import drain_events
from app.services.notifications.generators import generate_runway_notifications


def _register(client, email: str | None = None, password: str = "pw1234567"):
    email = email or f"u-{uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json(), email


async def _seed_notification(
    async_session,
    org_id: str,
    *,
    type_: str = "spending",
    severity: str = "warning",
    title: str = "Test notification",
    message: str = "Body",
    read_at: datetime | None = None,
    archived_at: datetime | None = None,
    snoozed_until: datetime | None = None,
) -> Notification:
    n = Notification(
        id=str(uuid4()),
        org_id=org_id,
        type=type_,
        severity=severity,
        title=title,
        message=message,
        evidence_ids=[],
        deep_link=None,
        read_at=read_at,
        archived_at=archived_at,
        snoozed_until=snoozed_until,
    )
    async_session.add(n)
    await async_session.commit()
    return n


async def _fetch_org_id(client, token: str) -> str:
    r = client.get("/org", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ---------------------------------------------------------------------------
# Snooze
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_snooze_hides_from_unread_until_elapsed(client, async_session):
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)
    n = await _seed_notification(async_session, org_id)

    drain_events()
    r = client.post(
        f"/notifications/{n.id}/snooze",
        headers={"Authorization": f"Bearer {token}"},
        json={"duration": "1h"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["snoozed_until"] is not None

    # Unread list should NOT include it while snoozed.
    unread = client.get(
        "/notifications?status=unread",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert unread.status_code == 200
    ids = [row["id"] for row in unread.json()]
    assert n.id not in ids

    # All list still includes it.
    all_ = client.get(
        "/notifications?status=all",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert all_.status_code == 200
    assert n.id in [row["id"] for row in all_.json()]


@pytest.mark.asyncio
@pytest.mark.parametrize("duration", ["1h", "4h", "24h", "monday"])
async def test_snooze_accepts_discrete_durations(client, async_session, duration):
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)
    n = await _seed_notification(async_session, org_id)

    r = client.post(
        f"/notifications/{n.id}/snooze",
        headers={"Authorization": f"Bearer {token}"},
        json={"duration": duration},
    )
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_snooze_rejects_arbitrary_duration(client, async_session):
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)
    n = await _seed_notification(async_session, org_id)

    r = client.post(
        f"/notifications/{n.id}/snooze",
        headers={"Authorization": f"Bearer {token}"},
        json={"duration": "47h"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_snooze_records_audit_and_publishes_event(client, async_session):
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)
    n = await _seed_notification(async_session, org_id)

    drain_events()
    r = client.post(
        f"/notifications/{n.id}/snooze",
        headers={"Authorization": f"Bearer {token}"},
        json={"duration": "4h"},
    )
    assert r.status_code == 200

    # Audit row exists for this entity.
    audits = (await async_session.execute(
        select(AuditLog).where(AuditLog.entity_id == n.id, AuditLog.action == "notification.snoozed")
    )).scalars().all()
    assert len(audits) == 1

    # Event published.
    events = drain_events()
    types = [t for (_, t, _) in events]
    assert "notification.updated" in types


@pytest.mark.asyncio
async def test_snoozed_notification_returns_to_unread_after_expiry(client, async_session):
    """When snoozed_until is in the past, item reappears in Unread."""
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)
    past = datetime.now(UTC) - timedelta(hours=1)
    n = await _seed_notification(async_session, org_id, snoozed_until=past)

    r = client.get(
        "/notifications?status=unread",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert n.id in [row["id"] for row in r.json()]


# ---------------------------------------------------------------------------
# Mutations publish events
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mark_read_publishes_event_and_audits(client, async_session):
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)
    n = await _seed_notification(async_session, org_id)

    drain_events()
    r = client.post(
        f"/notifications/{n.id}/read",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200

    audits = (await async_session.execute(
        select(AuditLog).where(AuditLog.entity_id == n.id, AuditLog.action == "notification.read")
    )).scalars().all()
    assert len(audits) == 1
    assert "notification.updated" in [t for (_, t, _) in drain_events()]


@pytest.mark.asyncio
async def test_archive_publishes_event_and_audits(client, async_session):
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)
    n = await _seed_notification(async_session, org_id)

    drain_events()
    r = client.post(
        f"/notifications/{n.id}/archive",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200

    audits = (await async_session.execute(
        select(AuditLog).where(AuditLog.entity_id == n.id, AuditLog.action == "notification.archived")
    )).scalars().all()
    assert len(audits) == 1
    assert "notification.updated" in [t for (_, t, _) in drain_events()]


# ---------------------------------------------------------------------------
# Preferences round-trip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_preferences_default_when_unset(client):
    reg, _ = _register(client)
    token = reg["access_token"]
    r = client.get(
        "/notifications/preferences",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    # Returns one entry per known type with both channels enabled by default.
    by_type = {p["type"]: p for p in body}
    for known in ("spending", "invoice", "runway", "funding", "system"):
        assert known in by_type
        assert by_type[known]["in_app"] is True
        assert by_type[known]["email"] is True


@pytest.mark.asyncio
async def test_preferences_put_persists(client, async_session):
    reg, _ = _register(client)
    token = reg["access_token"]

    payload = {
        "preferences": [
            {"type": "spending", "in_app": True, "email": False},
            {"type": "runway", "in_app": False, "email": True},
        ]
    }
    r = client.put(
        "/notifications/preferences",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert r.status_code == 200, r.text

    r2 = client.get(
        "/notifications/preferences",
        headers={"Authorization": f"Bearer {token}"},
    )
    by_type = {p["type"]: p for p in r2.json()}
    assert by_type["spending"]["in_app"] is True
    assert by_type["spending"]["email"] is False
    assert by_type["runway"]["in_app"] is False
    assert by_type["runway"]["email"] is True

    # An untouched type still has the default both-true.
    assert by_type["invoice"]["in_app"] is True
    assert by_type["invoice"]["email"] is True


@pytest.mark.asyncio
async def test_preferences_put_audits(client, async_session):
    reg, _ = _register(client)
    token = reg["access_token"]
    user_id = reg["user"]["id"]

    r = client.put(
        "/notifications/preferences",
        headers={"Authorization": f"Bearer {token}"},
        json={"preferences": [{"type": "spending", "in_app": False, "email": False}]},
    )
    assert r.status_code == 200

    audits = (await async_session.execute(
        select(AuditLog).where(
            AuditLog.user_id == user_id,
            AuditLog.action == "notification_preference.updated",
        )
    )).scalars().all()
    assert len(audits) >= 1


@pytest.mark.asyncio
async def test_preferences_round_trip_updates_existing_row(client, async_session):
    """Second PUT mutates the same row instead of inserting a duplicate."""
    reg, _ = _register(client)
    token = reg["access_token"]
    user_id = reg["user"]["id"]

    client.put(
        "/notifications/preferences",
        headers={"Authorization": f"Bearer {token}"},
        json={"preferences": [{"type": "spending", "in_app": False, "email": False}]},
    )
    client.put(
        "/notifications/preferences",
        headers={"Authorization": f"Bearer {token}"},
        json={"preferences": [{"type": "spending", "in_app": True, "email": False}]},
    )

    rows = (await async_session.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.type == "spending",
        )
    )).scalars().all()
    assert len(rows) == 1
    assert rows[0].in_app is True
    assert rows[0].email is False


# ---------------------------------------------------------------------------
# Notification generators publish a notification.created SSE event
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generator_publishes_notification_created(client, async_session):
    """When a generator inserts a new notification, the SSE event fires."""
    reg, _ = _register(client)
    token = reg["access_token"]
    org_id = await _fetch_org_id(client, token)

    drain_events()
    # Use a sync session adapter for the generator; the generator runs in
    # the celery worker which uses sync sessions. Here we exercise the same
    # function with a thin sync shim built on top of the async session.
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.config import get_settings  # noqa: F401
    # Reuse the existing in-memory sqlite database from the async session
    # by reaching into its bind.
    bind = async_session.bind
    # Sync sibling engine pointing at the same URL.
    sync_url = str(bind.url).replace("+aiosqlite", "")
    sync_engine = create_engine(sync_url)
    # Recreate schema in the sync DB; the in-memory aiosqlite DB is private
    # to that connection, so use a fresh sync engine and re-create tables.
    from app.models.base import Base
    Base.metadata.create_all(sync_engine)

    with Session(sync_engine) as sync_session:
        # Create an org row in the sync DB so the FK is satisfied.
        # base_currency + fiscal_year_start_month are NOT NULL (phase 1.B);
        # supply them explicitly since raw SQL bypasses ORM defaults.
        sync_session.execute(
            __import__("sqlalchemy").text(
                "INSERT INTO orgs (id, name, base_currency, fiscal_year_start_month) "
                "VALUES (:id, :name, :base_currency, :fiscal_year_start_month)"
            ),
            {"id": org_id, "name": "Test", "base_currency": "USD", "fiscal_year_start_month": 1},
        )
        sync_session.commit()
        rows = generate_runway_notifications(
            sync_session, org_id, cash_weeks=3.0, source="test"
        )
        sync_session.commit()
        assert len(rows) >= 1

    events = drain_events()
    types = [t for (_, t, _) in events]
    assert "notification.created" in types
    # Payload includes the notification fields we care about.
    payload = next(p for (_, t, p) in events if t == "notification.created")
    assert payload["org_id"] == org_id
    assert payload["type"] == "runway"
    assert payload["severity"] in {"warning", "critical"}
    assert "title" in payload


# ---------------------------------------------------------------------------
# Cross-org isolation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_snooze_404_on_other_orgs_notification(client, async_session):
    """A user cannot snooze a notification in another org."""
    reg_a, _ = _register(client)
    reg_b, _ = _register(client)
    token_a = reg_a["access_token"]
    token_b = reg_b["access_token"]
    org_b = await _fetch_org_id(client, token_b)
    n = await _seed_notification(async_session, org_b)

    r = client.post(
        f"/notifications/{n.id}/snooze",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"duration": "1h"},
    )
    assert r.status_code == 404
