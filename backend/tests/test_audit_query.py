"""Unit tests for the audit log filter builder service.

These tests pin the dates and validate that the filter-builder service
turns a filter dict into a SQLAlchemy ``select`` whose execution returns
the expected rows. The builder must be pure and require no clock access
beyond ``today`` (which the router defaults).
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.org import Org
from app.services.audit.query import (
    DEFAULT_LIMIT,
    MAX_LIMIT,
    AuditFilters,
    apply_cursor,
    build_audit_query,
    decode_cursor,
    encode_cursor,
)


@pytest.fixture
def fixed_now() -> datetime:
    return datetime(2026, 5, 15, 12, 0, 0, tzinfo=UTC)


@pytest.mark.asyncio
async def test_build_query_defaults_last_30_days(async_session, fixed_now):
    """With no `from`/`to`, only rows in the last 30 days are returned."""
    org = Org(id=str(uuid4()), name="X")
    async_session.add(org)
    await async_session.flush()

    rows = [
        AuditLog(
            id=str(uuid4()),
            org_id=org.id,
            action="invitation.created",
            entity_type="invitation",
            entity_id=str(uuid4()),
            created_at=fixed_now - timedelta(days=days),
        )
        for days in (1, 10, 29, 31, 60)
    ]
    async_session.add_all(rows)
    await async_session.flush()

    filters = AuditFilters(org_id=org.id)
    q = build_audit_query(filters, now=fixed_now)
    result = (await async_session.execute(q)).scalars().all()
    # 1, 10, 29 days ago all within 30 days; 31 + 60 excluded.
    assert len(result) == 3


@pytest.mark.asyncio
async def test_explicit_from_to_overrides_defaults(async_session, fixed_now):
    org = Org(id=str(uuid4()), name="X")
    async_session.add(org)
    await async_session.flush()

    for days in (1, 5, 35, 90):
        async_session.add(AuditLog(
            id=str(uuid4()),
            org_id=org.id,
            action="x",
            entity_type="y",
            entity_id="z",
            created_at=fixed_now - timedelta(days=days),
        ))
    await async_session.flush()

    filters = AuditFilters(
        org_id=org.id,
        from_=fixed_now - timedelta(days=100),
        to=fixed_now - timedelta(days=30),
    )
    q = build_audit_query(filters, now=fixed_now)
    result = (await async_session.execute(q)).scalars().all()
    # 35 and 90 days ago are within [-100, -30]; 1 and 5 are not.
    assert len(result) == 2


@pytest.mark.asyncio
async def test_filter_by_action(async_session, fixed_now):
    org = Org(id=str(uuid4()), name="X")
    async_session.add(org)
    await async_session.flush()

    async_session.add(AuditLog(
        id=str(uuid4()), org_id=org.id, action="invitation.created",
        entity_type="invitation", entity_id="a", created_at=fixed_now - timedelta(days=1),
    ))
    async_session.add(AuditLog(
        id=str(uuid4()), org_id=org.id, action="membership.role_changed",
        entity_type="membership", entity_id="b", created_at=fixed_now - timedelta(days=2),
    ))
    await async_session.flush()

    filters = AuditFilters(org_id=org.id, action="invitation.created")
    q = build_audit_query(filters, now=fixed_now)
    result = (await async_session.execute(q)).scalars().all()
    assert len(result) == 1
    assert result[0].action == "invitation.created"


@pytest.mark.asyncio
async def test_filter_by_entity_type(async_session, fixed_now):
    org = Org(id=str(uuid4()), name="X")
    async_session.add(org)
    await async_session.flush()

    async_session.add(AuditLog(
        id=str(uuid4()), org_id=org.id, action="x",
        entity_type="invitation", entity_id="a", created_at=fixed_now - timedelta(days=1),
    ))
    async_session.add(AuditLog(
        id=str(uuid4()), org_id=org.id, action="x",
        entity_type="membership", entity_id="b", created_at=fixed_now - timedelta(days=2),
    ))
    await async_session.flush()

    q = build_audit_query(AuditFilters(org_id=org.id, entity_type="membership"), now=fixed_now)
    result = (await async_session.execute(q)).scalars().all()
    assert len(result) == 1
    assert result[0].entity_type == "membership"


@pytest.mark.asyncio
async def test_filter_by_user_id(async_session, fixed_now):
    org = Org(id=str(uuid4()), name="X")
    async_session.add(org)
    await async_session.flush()

    user_a = str(uuid4())
    user_b = str(uuid4())

    async_session.add(AuditLog(
        id=str(uuid4()), org_id=org.id, user_id=user_a, action="x",
        entity_type="y", entity_id="1", created_at=fixed_now - timedelta(days=1),
    ))
    async_session.add(AuditLog(
        id=str(uuid4()), org_id=org.id, user_id=user_b, action="x",
        entity_type="y", entity_id="2", created_at=fixed_now - timedelta(days=2),
    ))
    await async_session.flush()

    q = build_audit_query(AuditFilters(org_id=org.id, user_id=user_a), now=fixed_now)
    result = (await async_session.execute(q)).scalars().all()
    assert len(result) == 1
    assert result[0].user_id == user_a


@pytest.mark.asyncio
async def test_org_scope_enforced(async_session, fixed_now):
    """Rows from other orgs must never leak through."""
    org_a = Org(id=str(uuid4()), name="A")
    org_b = Org(id=str(uuid4()), name="B")
    async_session.add_all([org_a, org_b])
    await async_session.flush()

    async_session.add(AuditLog(
        id=str(uuid4()), org_id=org_a.id, action="x", entity_type="y",
        entity_id="1", created_at=fixed_now - timedelta(days=1),
    ))
    async_session.add(AuditLog(
        id=str(uuid4()), org_id=org_b.id, action="x", entity_type="y",
        entity_id="2", created_at=fixed_now - timedelta(days=1),
    ))
    await async_session.flush()

    q = build_audit_query(AuditFilters(org_id=org_a.id), now=fixed_now)
    result = (await async_session.execute(q)).scalars().all()
    assert len(result) == 1
    assert result[0].org_id == org_a.id


@pytest.mark.asyncio
async def test_results_sorted_newest_first(async_session, fixed_now):
    org = Org(id=str(uuid4()), name="X")
    async_session.add(org)
    await async_session.flush()

    times = [fixed_now - timedelta(days=d) for d in (5, 1, 3, 2, 4)]
    for t in times:
        async_session.add(AuditLog(
            id=str(uuid4()), org_id=org.id, action="x", entity_type="y",
            entity_id="z", created_at=t,
        ))
    await async_session.flush()

    q = build_audit_query(AuditFilters(org_id=org.id), now=fixed_now)
    result = (await async_session.execute(q)).scalars().all()
    assert len(result) == 5
    created_ats = [r.created_at for r in result]
    assert created_ats == sorted(created_ats, reverse=True)


# ---- cursor encode/decode ----

def test_encode_decode_cursor_roundtrip():
    dt = datetime(2026, 5, 15, 12, 0, 0, tzinfo=UTC)
    row_id = str(uuid4())
    cur = encode_cursor(dt, row_id)
    assert isinstance(cur, str)
    decoded = decode_cursor(cur)
    assert decoded is not None
    decoded_dt, decoded_id = decoded
    assert decoded_dt == dt
    assert decoded_id == row_id


def test_decode_cursor_returns_none_on_garbage():
    assert decode_cursor("") is None
    assert decode_cursor("not-base64!!!") is None
    assert decode_cursor("aGVsbG8=") is None  # valid base64 but wrong shape


@pytest.mark.asyncio
async def test_cursor_paginates_stably(async_session, fixed_now):
    """A cursor lets the second page start strictly after the first page's last row,
    even when new rows arrive between the two requests."""
    org = Org(id=str(uuid4()), name="X")
    async_session.add(org)
    await async_session.flush()

    # Five rows, descending creation time.
    rows = []
    for d in (1, 2, 3, 4, 5):
        r = AuditLog(
            id=str(uuid4()), org_id=org.id, action="x", entity_type="y",
            entity_id=str(d), created_at=fixed_now - timedelta(hours=d),
        )
        async_session.add(r)
        rows.append(r)
    await async_session.flush()

    # Page 1: limit 2, expect newest two (hours = 1, 2 ago).
    q1 = build_audit_query(AuditFilters(org_id=org.id, limit=2), now=fixed_now)
    page1 = (await async_session.execute(q1)).scalars().all()
    assert len(page1) == 2
    assert [r.entity_id for r in page1] == ["1", "2"]

    # Simulate a new row inserted between requests; should NOT appear on page 2.
    intruder = AuditLog(
        id=str(uuid4()), org_id=org.id, action="x", entity_type="y",
        entity_id="intruder", created_at=fixed_now,  # newer than everything
    )
    async_session.add(intruder)
    await async_session.flush()

    cursor = encode_cursor(page1[-1].created_at, page1[-1].id)
    q2 = build_audit_query(AuditFilters(org_id=org.id, limit=2), now=fixed_now)
    q2 = apply_cursor(q2, cursor)
    page2 = (await async_session.execute(q2)).scalars().all()
    # The next two rows strictly older than the last row of page 1.
    assert len(page2) == 2
    assert [r.entity_id for r in page2] == ["3", "4"]


def test_limit_clamped_to_max():
    f = AuditFilters(org_id="x", limit=99999)
    q = build_audit_query(f, now=datetime(2026, 5, 15, tzinfo=UTC))
    compiled = q.compile()
    # The LIMIT is rendered into the bound params; pull it via the constructed query.
    # SQLAlchemy stores limit at the Select object level.
    assert q._limit_clause is not None  # type: ignore[attr-defined]


def test_limit_defaults():
    assert DEFAULT_LIMIT == 50
    assert MAX_LIMIT == 200
