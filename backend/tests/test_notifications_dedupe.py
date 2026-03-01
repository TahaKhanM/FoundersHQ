"""Tests for notification generators: severity order and threshold."""
import pytest
from app.services.notifications.generators import SEVERITY_ORDER


def test_severity_order():
    assert SEVERITY_ORDER["info"] < SEVERITY_ORDER["warning"] < SEVERITY_ORDER["critical"]
