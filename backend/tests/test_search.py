"""Tests for deterministic search ranking (no LLM)."""
from datetime import date
import pytest
from app.api.routers.search import _text_score, _recency_score, STATIC_PAGES


def test_text_score_exact_match():
    assert _text_score("runway", "runway") == 1.0
    assert _text_score("runway", "Runway") == 1.0


def test_text_score_prefix():
    assert _text_score("run", "runway") == 0.8
    assert _text_score("inv", "invoices") == 0.8


def test_text_score_contains():
    assert _text_score("way", "runway") == 0.5
    assert _text_score("flow", "outflow") == 0.5


def test_text_score_no_match():
    assert _text_score("xyz", "runway") == 0.0
    assert _text_score("run", None) == 0.0


def test_recency_score_same_day():
    ref = date(2025, 3, 1)
    assert _recency_score(date(2025, 3, 1), ref) == 1.0


def test_recency_score_old():
    ref = date(2025, 3, 1)
    assert _recency_score(date(2024, 1, 1), ref) == 0.3


def test_recency_score_none():
    assert _recency_score(None, date(2025, 3, 1)) == 0.5


def test_static_pages_include_runway():
    ids = [p["id"] for p in STATIC_PAGES]
    assert "runway" in ids
    assert "dashboard" in ids


def test_search_ordering_deterministic():
    """Score desc, then type, then id gives stable order."""
    from app.api.schemas import SearchResultDTO
    a = SearchResultDTO(type="page", id="runway", title="Runway", deep_link="/runway", score=70.0, match_reason="text_match")
    b = SearchResultDTO(type="page", id="dashboard", title="Dashboard", deep_link="/dashboard", score=70.0, match_reason="text_match")
    sorted_list = sorted([b, a], key=lambda r: (-r.score, r.type, r.id))
    assert sorted_list[0].id == "dashboard"
    assert sorted_list[1].id == "runway"
