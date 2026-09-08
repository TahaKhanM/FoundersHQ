"""Exercise the real API across authentication, organization and role boundaries."""
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.models.org import Membership
from app.models.user import User
from app.utils.security import create_access_token


@pytest.mark.parametrize("subject", ["not-a-uuid", "", "1234"])
def test_malformed_signed_subject_is_unauthorized(client, subject):
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {create_access_token(subject)}"})
    assert response.status_code == 401


@pytest.mark.parametrize("settings", [
    {"env": "production"},
    {"env": "prod"},
    {"env": "prod", "secret_key": "dev-secret"},
    {"env": "prod", "secret_key": "a" * 40, "debug": True},
])
def test_unsafe_production_configuration_is_rejected(settings):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **settings)


def test_production_configuration_accepts_explicit_secret():
    assert Settings(_env_file=None, env="prod", secret_key="a" * 40).env == "prod"


async def actor(async_session, client, role):
    registration = client.post("/auth/register", json={
        "email": f"owner-{uuid4()}@example.com", "password": "password123",
    }).json()
    owner_headers = {"Authorization": f"Bearer {registration['access_token']}"}
    org_id = client.get("/org", headers=owner_headers).json()["id"]
    user = User(id=str(uuid4()), email=f"user-{uuid4()}@example.com", password_hash="unused")
    membership = Membership(id=str(uuid4()), user_id=user.id, org_id=org_id, role=role)
    async_session.add_all([user, membership])
    await async_session.commit()
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}, membership, owner_headers


@pytest.mark.parametrize(("method", "path", "body"), [
    ("post", "/ingest/questionnaire", {"cash_balance": "9000", "currency": "USD"}),
    ("post", "/runway/forecast/compute", {"horizon_weeks": 2}),
    ("post", "/runway/scenarios", {"name": "unauthorized"}),
    ("post", "/onboarding/complete", {}),
    ("delete", "/org/data", {"confirm": True}),
])
async def test_viewer_cannot_change_shared_financial_data(client, async_session, method, path, body):
    headers, _, _ = await actor(async_session, client, "viewer")
    response = client.request(method, path, headers=headers, json=body)
    assert response.status_code == 403, response.text


async def test_admin_cannot_promote_self_to_owner_or_purge_data(client, async_session):
    headers, membership, _ = await actor(async_session, client, "admin")
    assert client.patch(f"/org/members/{membership.id}", headers=headers, json={"role": "owner"}).status_code == 403
    assert client.request("DELETE", "/org/data", headers=headers, json={"confirm": True}).status_code == 403
    assert client.post("/org/invitations", headers=headers, json={"email": "x@example.com", "role": "owner"}).status_code == 422


async def test_job_status_requires_auth_and_scoped_evidence(client, async_session):
    job_id = str(uuid4())
    assert client.get(f"/ingest/jobs/{job_id}").status_code == 401
    headers, _, _ = await actor(async_session, client, "member")
    # The route must stop before querying Redis when this org did not enqueue the job.
    assert client.get(f"/ingest/jobs/{job_id}", headers=headers).status_code == 404
