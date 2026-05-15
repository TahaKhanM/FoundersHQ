"""Typed error → JSON response tests."""
from __future__ import annotations

from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app.middleware.request_id import RequestIdMiddleware
from app.utils.errors import AppError, register_error_handlers


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)
    register_error_handlers(app)
    router = APIRouter()

    @router.get("/boom")
    def boom() -> dict:
        raise AppError(
            code="thing_not_found",
            message="missing",
            status_code=404,
            details={"id": "x"},
        )

    @router.get("/bad")
    def bad() -> dict:
        raise AppError(code="invalid_input", message="nope")

    app.include_router(router)
    return app


def test_app_error_returns_typed_json() -> None:
    client = TestClient(_build_app())
    r = client.get("/boom")
    assert r.status_code == 404
    body = r.json()
    assert body["code"] == "thing_not_found"
    assert body["message"] == "missing"
    assert body["details"] == {"id": "x"}
    assert "request_id" in body
    assert body["request_id"] is not None


def test_app_error_defaults_to_400_with_empty_details() -> None:
    client = TestClient(_build_app())
    r = client.get("/bad")
    assert r.status_code == 400
    body = r.json()
    assert body["code"] == "invalid_input"
    assert body["message"] == "nope"
    assert body["details"] == {}


def test_request_id_in_error_matches_response_header() -> None:
    client = TestClient(_build_app())
    rid = "22222222-2222-4222-8222-222222222222"
    r = client.get("/boom", headers={"x-request-id": rid})
    assert r.json()["request_id"] == rid
    assert r.headers["x-request-id"] == rid
