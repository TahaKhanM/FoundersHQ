"""Audit helper tests."""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.utils.audit import record_audit


@pytest.mark.asyncio
async def test_record_audit_writes_a_row(async_session, seeded_org, seeded_user) -> None:
    entity_id = str(uuid.uuid4())
    await record_audit(
        async_session,
        org=seeded_org,
        user=seeded_user,
        action="transaction.updated",
        entity_type="transaction",
        entity_id=entity_id,
        details={"field": "category_id"},
        request_id="req-1",
    )
    await async_session.commit()

    rows = (
        await async_session.execute(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(1)
        )
    ).scalars().all()
    assert len(rows) == 1
    row = rows[0]
    assert row.action == "transaction.updated"
    assert row.entity_type == "transaction"
    assert row.entity_id == entity_id
    assert row.org_id == seeded_org.id
    assert row.user_id == seeded_user.id
    assert row.details["field"] == "category_id"
    assert row.request_id == "req-1"


@pytest.mark.asyncio
async def test_record_audit_accepts_no_user_and_no_details(
    async_session, seeded_org
) -> None:
    """Background jobs may not have a user; details defaults to empty dict."""
    await record_audit(
        async_session,
        org=seeded_org,
        user=None,
        action="system.tick",
        entity_type="system",
        entity_id="-",
    )
    await async_session.commit()
    rows = (await async_session.execute(select(AuditLog))).scalars().all()
    assert len(rows) == 1
    assert rows[0].user_id is None
    assert rows[0].details == {}
    assert rows[0].request_id is None
