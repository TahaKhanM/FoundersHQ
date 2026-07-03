"""Runway-change generator: threshold, direction, missing data."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.services.insights.runway_change import (
    ForecastSnapshot,
    detect_runway_change,
)


def _snap(
    gen: str,
    base: float | None,
    pess: float | None = None,
    attribution: list[tuple[str, str, list[str]]] | None = None,
) -> ForecastSnapshot:
    return ForecastSnapshot(
        generated_at=date.fromisoformat(gen),
        cash_weeks_base=base,
        cash_weeks_pess=pess,
        attribution=[
            (date.fromisoformat(d), Decimal(amt), ids)
            for d, amt, ids in (attribution or [])
        ],
    )


# ---------------------------------------------------------------------------
# Threshold
# ---------------------------------------------------------------------------


def test_first_run_emits_nothing():
    """No prev snapshot → no comparison → no insight."""
    out = detect_runway_change(
        today=date(2026, 5, 16),
        prev_forecast=None,
        new_forecast=_snap("2026-05-16", 20.0),
    )
    assert out == []


def test_below_threshold_emits_nothing():
    """Change of 3 weeks is below the 4-week trigger."""
    out = detect_runway_change(
        today=date(2026, 5, 16),
        prev_forecast=_snap("2026-05-09", 20.0),
        new_forecast=_snap("2026-05-16", 17.0),
    )
    assert out == []


def test_negative_delta_above_threshold_fires_warn():
    out = detect_runway_change(
        today=date(2026, 5, 16),
        prev_forecast=_snap("2026-05-09", 20.0),
        new_forecast=_snap("2026-05-16", 15.0),
    )
    assert len(out) == 1
    assert out[0].severity == "warn"
    assert out[0].type == "runway_change"


def test_big_negative_delta_is_critical():
    out = detect_runway_change(
        today=date(2026, 5, 16),
        prev_forecast=_snap("2026-05-09", 20.0),
        new_forecast=_snap("2026-05-16", 8.0),
    )
    assert len(out) == 1
    assert out[0].severity == "critical"


def test_positive_delta_above_threshold_fires_info():
    """Good news — surface, but as info."""
    out = detect_runway_change(
        today=date(2026, 5, 16),
        prev_forecast=_snap("2026-05-09", 12.0),
        new_forecast=_snap("2026-05-16", 18.0),
    )
    assert len(out) == 1
    assert out[0].severity == "info"


# ---------------------------------------------------------------------------
# Missing / N/A
# ---------------------------------------------------------------------------


def test_prev_none_runway_emits_nothing():
    out = detect_runway_change(
        today=date(2026, 5, 16),
        prev_forecast=_snap("2026-05-09", None),
        new_forecast=_snap("2026-05-16", 20.0),
    )
    assert out == []


def test_new_none_runway_emits_nothing():
    out = detect_runway_change(
        today=date(2026, 5, 16),
        prev_forecast=_snap("2026-05-09", 20.0),
        new_forecast=_snap("2026-05-16", None),
    )
    assert out == []


# ---------------------------------------------------------------------------
# Evidence
# ---------------------------------------------------------------------------


def test_evidence_uses_top_3_attribution_rows():
    """Evidence is the top-3 weekly deltas by absolute size."""
    out = detect_runway_change(
        today=date(2026, 5, 16),
        prev_forecast=_snap("2026-05-09", 20.0),
        new_forecast=_snap(
            "2026-05-16",
            14.0,
            attribution=[
                ("2026-05-09", "-100", ["a"]),
                ("2026-05-16", "-5000", ["big-tx"]),
                ("2026-05-23", "-2000", ["mid-tx"]),
                ("2026-05-30", "-1000", ["small-tx"]),
                ("2026-06-06", "-50", ["tiny"]),
            ],
        ),
    )
    assert len(out) == 1
    ev = set(out[0].evidence_ids)
    assert "big-tx" in ev
    assert "mid-tx" in ev
    assert "small-tx" in ev
    # Tiny + 100 deltas should NOT be in the top-3.
    assert "tiny" not in ev
