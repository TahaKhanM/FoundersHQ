"""Per-request UUID middleware: attaches `request.state.request_id` and `X-Request-ID` header."""
from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

HEADER = "x-request-id"


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Attach a per-request UUID to `request.state.request_id` and echo it back as a header."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        rid = request.headers.get(HEADER) or str(uuid.uuid4())
        request.state.request_id = rid
        response = await call_next(request)
        response.headers[HEADER] = rid
        return response
