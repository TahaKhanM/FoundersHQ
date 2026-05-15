"""Event publisher / SSE helpers.

Two APIs live here:

- :func:`publish_event` — the durable, outbox-first publisher from phase 0.B.
  Requires an active SQLAlchemy session and a Redis client. Writes the
  ``events_outbox`` row and then PUBLISHes to ``events:{org_id}``. Use this
  from mutation routes once you've finished the DB work.

- :func:`publish_event_best_effort` — a fire-and-forget alternative for
  cases where the route doesn't want to take a session dependency on the
  events pipeline (e.g. auth endpoints that already own their own commit
  semantics). It writes to a bounded in-process queue that tests drain via
  :func:`drain_events` / :func:`peek_events`. In production, a small Redis
  bridge job can ferry these to the real channel; for now we keep the
  surface deliberately simple.
"""
from __future__ import annotations

import logging
from collections import deque
from typing import Any

from app.services.events.publisher import publish_event

log = logging.getLogger(__name__)


_MAX_QUEUE = 1024
_test_queue: deque[tuple[str, str, dict[str, Any]]] = deque(maxlen=_MAX_QUEUE)


def publish_event_best_effort(org_id: str, event_type: str, payload: dict[str, Any]) -> None:
    """Append to the in-process queue. Never raises."""
    try:
        _test_queue.append((str(org_id), event_type, dict(payload)))
    except Exception:  # noqa: BLE001
        log.exception("publish_event_best_effort failed for %s", event_type)


def drain_events() -> list[tuple[str, str, dict[str, Any]]]:
    """Return all queued events and clear the queue."""
    items = list(_test_queue)
    _test_queue.clear()
    return items


def peek_events() -> list[tuple[str, str, dict[str, Any]]]:
    """Return all queued events without clearing."""
    return list(_test_queue)


__all__ = ["publish_event", "publish_event_best_effort", "drain_events", "peek_events"]
