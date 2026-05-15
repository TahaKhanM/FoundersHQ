"""Dev invariant: every org-scoped insert must carry an ``org_id``.

Registered as a SQLAlchemy ``before_flush`` listener on the session class.
In dev/test (``ENV != "prod"``) the listener raises :class:`OrgScopeViolation`
the moment a new instance whose table declares an ``org_id`` column is
flushed without one. In production it stays silent (the route layer is
responsible for scoping, and we don't want to take down the API if a
straggler slips through).
"""
from __future__ import annotations

import logging
import os
from typing import Any

from sqlalchemy import event

logger = logging.getLogger(__name__)


class OrgScopeViolation(RuntimeError):
    """Raised when an org-scoped row is flushed without ``org_id`` (dev only)."""


def _is_org_scoped(instance: Any) -> bool:
    table = getattr(instance.__class__, "__table__", None)
    if table is None:
        return False
    return "org_id" in table.columns


def _missing_org_id(instance: Any) -> bool:
    return getattr(instance, "org_id", None) is None


def register_org_scope_listener(session_class: type) -> None:
    """Install the ``before_flush`` listener on ``session_class``.

    Idempotent: calling twice does not register two listeners.
    """
    if getattr(session_class, "_org_scope_listener_registered", False):
        return

    raise_on_violation = os.environ.get("ENV", "dev") != "prod"

    @event.listens_for(session_class, "before_flush")
    def _check_org_scope(session, flush_context, instances) -> None:  # noqa: ANN001, ARG001
        for obj in session.new:
            if not _is_org_scoped(obj):
                continue
            if _missing_org_id(obj):
                msg = f"{obj.__class__.__name__} flushed without org_id"
                if raise_on_violation:
                    raise OrgScopeViolation(msg)
                logger.warning("org_scope_violation: %s", msg)

    session_class._org_scope_listener_registered = True
