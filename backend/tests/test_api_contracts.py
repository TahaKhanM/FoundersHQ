"""API contract / smoke tests for key endpoints and DTO shapes.

These tests exercise the real FastAPI app, which opens a connection to the
configured Postgres on import. Marked `integration` so `make test` (which
runs `-m "not integration"`) skips them when DB isn't available locally.
CI brings up Postgres and runs the full suite.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.base import engine

pytestmark = pytest.mark.integration

@pytest.fixture(scope="module")
def api_client():
    """Keep pooled asyncpg connections on one event loop for this API session."""
    with TestClient(app) as client:
        try:
            yield client
        finally:
            assert client.portal is not None
            client.portal.call(engine.dispose)


def test_health(api_client):
    client = api_client
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_openapi_docs(api_client):
    client = api_client
    r = client.get("/openapi.json")
    assert r.status_code == 200
    data = r.json()
    assert "openapi" in data
    assert "paths" in data


def test_register_and_login(api_client):
    client = api_client
    email = f"test-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", json={"email": email, "password": "secret123"})
    assert r.status_code == 200
    data = r.json()
    assert "user" in data
    assert data["user"]["email"] == email
    assert "access_token" in data
    token = data["access_token"]
    r2 = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["email"] == email


def test_org_requires_auth(api_client):
    client = api_client
    r = client.get("/org")
    assert r.status_code == 401


def test_spending_metrics_requires_auth(api_client):
    client = api_client
    r = client.get("/spending/metrics")
    assert r.status_code == 401
