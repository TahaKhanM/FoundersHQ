"""Search service package.

Phase 1.F keeps the deterministic ranking helpers inside the router module
(``app.api.routers.search``). This package exists so future phases can drop in
heavier modules (e.g. the 2.F insights index) without churning callers.

Re-exports the public ranking helpers so callers can write
``from app.services.search import _text_score`` without reaching into the
router module directly.
"""
from app.api.routers.search import (
    INVOICE_STATUS_WEIGHT,
    STATIC_PAGES,
    _recency_score,
    _text_score,
    search_insights,
)

__all__ = [
    "INVOICE_STATUS_WEIGHT",
    "STATIC_PAGES",
    "_recency_score",
    "_text_score",
    "search_insights",
]
