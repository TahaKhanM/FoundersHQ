"""Contract tests for the audit log router.

Covers: admin/owner gate (member -> 403); date-range default; pagination
cursor stability across an interloping insert; CSV export shape and row
count parity.
"""
from __future__ import annotations

import csv
import io
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.models.audit import AuditLog
from app.models.org import Membership
from app.models.user import User
from app.utils.hashing import hash_password
from app.utils.security import create_access_token


def _register(client, email: str, password: str = "pw1234567"):
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


async def _fetch_org_id(client, token: str) -> str:
    r = client.get("/org", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


async def _attach_user(async_session, *, org_id: str, role: str) -> tuple[User, str]:
    u = User(
        id=str(uuid4()),
        email=f"u-{uuid4().hex[:6]}@ex.com",
        password_hash=hash_password("pw1234567"),
    )
    m = Membership(id=str(uuid4()), user_id=u.id, org_id=org_id, role=role)
    async_session.add_all([u, m])
    await async_session.commit()
    return u, create_access_token(u.id)


async def _seed_audit_rows(
    async_session,
    *,
    org_id: str,
    user_id: str | None = None,
    count: int = 3,
    action: str = "test.action",
    entity_type: str = "thing",
    base_time: datetime | None = None,
) -> list[AuditLog]:
    base = base_time or datetime.now(UTC)
    rows = []
    for i in range(count):
        r = AuditLog(
            id=str(uuid4()),
            org_id=org_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=f"e-{i}",
            details={"index": i},
            request_id=f"req-{i}",
            created_at=base - timedelta(minutes=i),
        )
        async_session.add(r)
        rows.append(r)
    await async_session.commit()
    return rows


@pytest.mark.asyncio
async def test_list_audit_logs_requires_auth(client):
    r = client.get("/audit")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_member_role_forbidden(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    org_id = await _fetch_org_id(client, owner["access_token"])
    _user, member_token = await _attach_user(async_session, org_id=org_id, role="member")

    r = client.get("/audit", headers={"Authorization": f"Bearer {member_token}"})
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "forbidden"


@pytest.mark.asyncio
async def test_admin_role_allowed(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    org_id = await _fetch_org_id(client, owner["access_token"])
    _user, admin_token = await _attach_user(async_session, org_id=org_id, role="admin")

    r = client.get("/audit", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_owner_can_list_and_sees_org_rows(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    owner_token = owner["access_token"]
    org_id = await _fetch_org_id(client, owner_token)

    # Registration already produced at least one audit row; seed a few more.
    await _seed_audit_rows(async_session, org_id=org_id, count=3, action="x")

    r = client.get("/audit", headers={"Authorization": f"Bearer {owner_token}"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "items" in body
    assert "next_cursor" in body
    actions = [item["action"] for item in body["items"]]
    assert "x" in actions


@pytest.mark.asyncio
async def test_filter_by_action_narrows_results(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    token = owner["access_token"]
    org_id = await _fetch_org_id(client, token)

    await _seed_audit_rows(async_session, org_id=org_id, count=2, action="alpha")
    await _seed_audit_rows(async_session, org_id=org_id, count=3, action="beta")

    r = client.get("/audit?action=alpha", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert all(it["action"] == "alpha" for it in items)
    assert len(items) == 2


@pytest.mark.asyncio
async def test_default_date_window_is_30_days(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    token = owner["access_token"]
    org_id = await _fetch_org_id(client, token)

    now = datetime.now(UTC)
    async_session.add(AuditLog(
        id=str(uuid4()), org_id=org_id, action="recent",
        entity_type="x", entity_id="1", created_at=now - timedelta(days=5),
    ))
    async_session.add(AuditLog(
        id=str(uuid4()), org_id=org_id, action="ancient",
        entity_type="x", entity_id="2", created_at=now - timedelta(days=60),
    ))
    await async_session.commit()

    r = client.get("/audit", headers={"Authorization": f"Bearer {token}"})
    items = r.json()["items"]
    actions = [it["action"] for it in items]
    assert "recent" in actions
    assert "ancient" not in actions


@pytest.mark.asyncio
async def test_pagination_cursor_is_stable_across_inserts(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    token = owner["access_token"]
    org_id = await _fetch_org_id(client, token)

    base = datetime.now(UTC) - timedelta(hours=1)
    seeded = await _seed_audit_rows(
        async_session, org_id=org_id, count=5, action="page",
        base_time=base,
    )

    # Page 1
    r1 = client.get(
        "/audit?action=page&limit=2",
        headers={"Authorization": f"Bearer {token}"},
    )
    body1 = r1.json()
    assert len(body1["items"]) == 2
    assert body1["next_cursor"] is not None
    page1_ids = {it["id"] for it in body1["items"]}

    # Interloping insert (newer than everything).
    async_session.add(AuditLog(
        id=str(uuid4()), org_id=org_id, action="page",
        entity_type="thing", entity_id="intruder",
        created_at=datetime.now(UTC),
    ))
    await async_session.commit()

    # Page 2 using cursor — must NOT include the intruder.
    r2 = client.get(
        f"/audit?action=page&limit=2&cursor={body1['next_cursor']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    body2 = r2.json()
    page2_ids = {it["id"] for it in body2["items"]}
    assert page1_ids.isdisjoint(page2_ids)
    # Only original seeds appear, never the intruder.
    seeded_ids = {r.id for r in seeded}
    assert page2_ids.issubset(seeded_ids)


@pytest.mark.asyncio
async def test_invalid_cursor_returns_first_page(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    token = owner["access_token"]
    org_id = await _fetch_org_id(client, token)
    await _seed_audit_rows(async_session, org_id=org_id, count=2, action="x")

    r = client.get(
        "/audit?cursor=garbage-not-valid",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert isinstance(r.json()["items"], list)


@pytest.mark.asyncio
async def test_csv_export_streams_and_matches_filtered_count(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    token = owner["access_token"]
    org_id = await _fetch_org_id(client, token)

    await _seed_audit_rows(async_session, org_id=org_id, count=4, action="csv")
    await _seed_audit_rows(async_session, org_id=org_id, count=2, action="other")

    # Filtered API list — base count of `csv` rows
    r_list = client.get(
        "/audit?action=csv&limit=200",
        headers={"Authorization": f"Bearer {token}"},
    )
    list_count = len(r_list.json()["items"])

    r = client.get(
        "/audit/export.csv?action=csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("text/csv")
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd
    assert ".csv" in cd

    rows = list(csv.reader(io.StringIO(r.text)))
    assert rows[0] == [
        "created_at",
        "action",
        "entity_type",
        "entity_id",
        "user_id",
        "request_id",
        "details",
    ]
    body_rows = rows[1:]
    assert len(body_rows) == list_count
    assert all(row[1] == "csv" for row in body_rows)


@pytest.mark.asyncio
async def test_csv_export_requires_admin(client, async_session):
    owner = _register(client, email=f"o-{uuid4().hex[:6]}@ex.com")
    org_id = await _fetch_org_id(client, owner["access_token"])
    _u, member_token = await _attach_user(async_session, org_id=org_id, role="member")

    r = client.get(
        "/audit/export.csv", headers={"Authorization": f"Bearer {member_token}"}
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_audit_log_org_scoped(client, async_session):
    """Owner of org A must not see audit rows from org B."""
    owner_a = _register(client, email=f"a-{uuid4().hex[:6]}@ex.com")
    token_a = owner_a["access_token"]
    org_a_id = await _fetch_org_id(client, token_a)

    # A second org with its own audit row.
    from app.models.org import Org as OrgModel
    org_b = OrgModel(id=str(uuid4()), name="B")
    async_session.add(org_b)
    await async_session.flush()
    async_session.add(AuditLog(
        id=str(uuid4()), org_id=org_b.id, action="cross-org",
        entity_type="x", entity_id="1", created_at=datetime.now(UTC),
    ))
    await async_session.commit()

    r = client.get(
        "/audit?limit=200", headers={"Authorization": f"Bearer {token_a}"}
    )
    actions = [it["action"] for it in r.json()["items"]]
    assert "cross-org" not in actions
    # All returned rows belong to org A.
    assert all(it["org_id"] == org_a_id for it in r.json()["items"])
