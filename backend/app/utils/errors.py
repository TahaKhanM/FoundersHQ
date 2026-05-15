"""Typed exception → JSON response.

Routes raise :class:`AppError` to return a typed JSON body of the form
``{"code", "message", "details", "request_id"}``. The ``request_id`` is
populated from ``request.state.request_id`` (set by
:class:`app.middleware.request_id.RequestIdMiddleware`).

Call :func:`register_error_handlers` once at app startup.
"""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Raised by routes/services to surface a typed JSON error."""

    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details: dict[str, Any] = details or {}


def register_error_handlers(app: FastAPI) -> None:
    """Install the :class:`AppError` → JSON handler on ``app``."""

    @app.exception_handler(AppError)
    async def _handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        rid = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "request_id": rid,
            },
        )
