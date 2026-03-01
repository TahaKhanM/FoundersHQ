"""Tests for deterministic health score formula and clipping."""
import pytest
from app.services.dashboard.health_score import (
    compute_health_score,
    s_runway,
    s_invoice,
    clip,
    W_RUNWAY,
    W_BURN,
    W_INVOICE,
)


def test_clip():
    assert clip(50, 0, 100) == 50
    assert clip(-10, 0, 100) == 0
    assert clip(150, 0, 100) == 100


def test_s_runway():
    assert s_runway(26) == 100.0
    assert s_runway(0) == 0.0
    assert s_runway(13) == 50.0
    assert s_runway(None) == 0.0


def test_s_invoice():
    assert s_invoice(1.0) == 100.0
    assert s_invoice(0.5) == 50.0
    assert s_invoice(None) == 50.0


def test_health_score_weights_sum():
    score, breakdown = compute_health_score(
        cash_weeks=26,
        run_rate_stable=True,
        has_90d_data=True,
        on_time_ratio=1.0,
        concentration_risk=0.0,
        has_commitments=True,
        commitment_enabled_count=1,
        funding_opportunity_count=5,
    )
    assert 0 <= score <= 100
    total_weight = sum(b[3] for b in breakdown)
    assert abs(total_weight - 100.0) < 0.01
    assert score == 100.0
