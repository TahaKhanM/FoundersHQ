"""Onboarding service: pure-Python state machine + persistence helpers.

The wizard has 4 steps. Step 1 captures org profile (name, base currency,
fiscal year start). Step 2 captures persona. Step 3 captures a data-source
choice (seed_sample / import_csv / start_empty). Step 4 is the completion
acknowledgement.

State for an in-progress wizard lives on the `orgs` row directly — there's no
extra table — so a user finishing on another device picks up where they left
off via `GET /onboarding/state`.
"""
from app.services.onboarding.state import (
    OnboardingCapture,
    OnboardingStepDataPayload,
    OnboardingStepOrgPayload,
    OnboardingStepPersonaPayload,
    StateValidationError,
    StepResult,
    derive_current_step,
    next_step,
)

__all__ = [
    "OnboardingCapture",
    "OnboardingStepDataPayload",
    "OnboardingStepOrgPayload",
    "OnboardingStepPersonaPayload",
    "StateValidationError",
    "StepResult",
    "derive_current_step",
    "next_step",
]
