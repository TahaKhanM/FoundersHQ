"""Phase 1.B: onboarding state machine + Org profile columns.

Pure-Python tests for `app.services.onboarding.state`. No DB; just the state
machine's transitions and payload validation. The Org-model assertions
(persona/currency/etc. fields exist) live alongside since they're trivial
schema-level checks.
"""
from __future__ import annotations

import pytest
import pytest_asyncio  # noqa: F401  # ensure plugin loaded for async fixtures

from app.models.base import gen_uuid
from app.models.org import Org, Persona
from app.services.onboarding.state import (
    OnboardingCapture,
    OnboardingStepDataPayload,
    OnboardingStepOrgPayload,
    OnboardingStepPersonaPayload,
    StateValidationError,
    next_step,
)

# ----- Org model columns -----

@pytest.mark.asyncio
async def test_org_defaults_have_base_currency_usd_and_jan_fy_start(async_session):
    """The new columns default to USD / January / null at the DB layer."""
    org = Org(id=gen_uuid(), name="Acme")
    async_session.add(org)
    await async_session.flush()
    await async_session.refresh(org)
    assert org.base_currency == "USD"
    assert org.fiscal_year_start_month == 1
    assert org.industry is None
    assert org.stage is None
    assert org.persona is None
    assert org.onboarding_completed_at is None


def test_org_accepts_custom_currency_and_fy_start():
    """Constructor kwargs round-trip without a flush."""
    org = Org(name="Acme", base_currency="EUR", fiscal_year_start_month=4)
    assert org.base_currency == "EUR"
    assert org.fiscal_year_start_month == 4


def test_persona_enum_values():
    # Stable identifiers shared with the frontend radio group.
    assert Persona.founder_operator.value == "founder_operator"
    assert Persona.first_time_founder.value == "first_time_founder"
    assert Persona.second_time_founder.value == "second_time_founder"
    assert Persona.ops_finance_lead.value == "ops_finance_lead"


# ----- State machine transitions -----

def test_step_1_valid_payload_advances_to_persona():
    capture = OnboardingCapture()
    payload = OnboardingStepOrgPayload(
        step="org",
        org_name="Acme",
        base_currency="USD",
        fiscal_year_start_month=1,
    )
    result = next_step(current_step=1, capture=capture, payload=payload)
    assert result.next_step == 2
    assert result.completed is False
    assert result.capture.org_name == "Acme"
    assert result.capture.base_currency == "USD"
    assert result.capture.fiscal_year_start_month == 1


def test_step_1_rejects_invalid_currency():
    with pytest.raises(StateValidationError):
        OnboardingStepOrgPayload(
            step="org",
            org_name="Acme",
            base_currency="usd",  # must be upper-case ISO-4217-ish
            fiscal_year_start_month=1,
        )


def test_step_1_rejects_invalid_fy_month():
    with pytest.raises(StateValidationError):
        OnboardingStepOrgPayload(
            step="org",
            org_name="Acme",
            base_currency="USD",
            fiscal_year_start_month=13,
        )


def test_step_1_rejects_empty_org_name():
    with pytest.raises(StateValidationError):
        OnboardingStepOrgPayload(
            step="org",
            org_name="   ",
            base_currency="USD",
            fiscal_year_start_month=1,
        )


def test_step_2_valid_payload_advances_to_data():
    capture = OnboardingCapture(
        org_name="Acme", base_currency="USD", fiscal_year_start_month=1
    )
    payload = OnboardingStepPersonaPayload(step="persona", persona=Persona.first_time_founder)
    result = next_step(current_step=2, capture=capture, payload=payload)
    assert result.next_step == 3
    assert result.completed is False
    assert result.capture.persona == Persona.first_time_founder


def test_step_2_rejects_unknown_persona_string():
    with pytest.raises(StateValidationError):
        OnboardingStepPersonaPayload(step="persona", persona="time_traveler")


def test_step_3_sample_seeds_and_advances_to_done():
    capture = OnboardingCapture(
        org_name="Acme",
        base_currency="USD",
        fiscal_year_start_month=1,
        persona=Persona.founder_operator,
    )
    payload = OnboardingStepDataPayload(step="data", choice="seed_sample")
    result = next_step(current_step=3, capture=capture, payload=payload)
    assert result.next_step == 4
    assert result.completed is False
    assert result.capture.data_choice == "seed_sample"


def test_step_3_csv_import_and_empty_also_advance():
    capture = OnboardingCapture(
        org_name="Acme",
        base_currency="USD",
        fiscal_year_start_month=1,
        persona=Persona.founder_operator,
    )
    for choice in ("import_csv", "start_empty"):
        payload = OnboardingStepDataPayload(step="data", choice=choice)
        result = next_step(current_step=3, capture=capture, payload=payload)
        assert result.next_step == 4
        assert result.capture.data_choice == choice


def test_step_3_rejects_unknown_data_choice():
    with pytest.raises(StateValidationError):
        OnboardingStepDataPayload(step="data", choice="mail_carrier_pigeon")


def test_step_4_marks_completed():
    # Step 4 has no payload — it's just the user clicking 'go to dashboard'.
    # `next_step` with current=4 returns completed=True.
    capture = OnboardingCapture(
        org_name="Acme",
        base_currency="USD",
        fiscal_year_start_month=1,
        persona=Persona.founder_operator,
        data_choice="seed_sample",
    )
    result = next_step(current_step=4, capture=capture, payload=None)
    assert result.completed is True
    assert result.next_step == 4  # no further step


def test_step_payload_must_match_step_number():
    """A step-2 (persona) payload posted to step 1 is rejected."""
    capture = OnboardingCapture()
    persona_payload = OnboardingStepPersonaPayload(
        step="persona", persona=Persona.founder_operator
    )
    with pytest.raises(StateValidationError):
        next_step(current_step=1, capture=capture, payload=persona_payload)


def test_cannot_complete_without_required_captures():
    """If org info is missing, step 4 raises rather than silently completing."""
    capture = OnboardingCapture()  # nothing captured
    with pytest.raises(StateValidationError):
        next_step(current_step=4, capture=capture, payload=None)


def test_unknown_step_raises():
    capture = OnboardingCapture()
    with pytest.raises(StateValidationError):
        next_step(current_step=42, capture=capture, payload=None)
