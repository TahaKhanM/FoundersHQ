"""API contract / smoke tests for key endpoints and DTO shapes."""
import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_openapi_docs():
    r = client.get("/openapi.json")
    assert r.status_code == 200
    data = r.json()
    assert "openapi" in data
    assert "paths" in data


def test_register_and_login():
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


def test_org_requires_auth():
    r = client.get("/org")
    assert r.status_code == 401


def test_spending_metrics_requires_auth():
    r = client.get("/spending/metrics")
    assert r.status_code == 401
