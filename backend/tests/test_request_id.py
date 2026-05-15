"""Request-ID middleware tests."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app


def test_request_id_header_present_in_response() -> None:
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    rid = r.headers.get("x-request-id")
    assert rid is not None
    uuid.UUID(rid)  # must be a valid uuid


def test_request_id_echoed_when_supplied() -> None:
    client = TestClient(app)
    rid = "11111111-1111-4111-8111-111111111111"
    r = client.get("/health", headers={"x-request-id": rid})
    assert r.headers["x-request-id"] == rid
