"""Pure-Python onboarding state machine.

This module is deliberately I/O-free. The router translates HTTP requests
into `next_step(...)` calls, mirrors the resulting capture onto the `orgs`
row, audits, and returns. Tests can exercise every transition without
touching a database.
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.models.org import Persona


class StateValidationError(ValueError):
    """Raised when a step payload is invalid or when a transition is illegal.

    Re-raises as a 422 at the router layer; tests assert on the type only,
    not the precise message.
    """


# ----- Step payloads (Pydantic discriminated union) -----
# Each payload class wraps its __init__ so a `pydantic.ValidationError` is
# rethrown as a `StateValidationError` — the only error type the state machine
# (and its tests) need to know about.


class _StateValidatingBase(BaseModel):
    """Base model: rethrow Pydantic ValidationError as StateValidationError."""

    model_config = ConfigDict(extra="forbid")

    def __init__(self, **data: Any) -> None:
        try:
            super().__init__(**data)
        except ValidationError as exc:
            raise StateValidationError(str(exc)) from exc


class OnboardingStepOrgPayload(_StateValidatingBase):
    """Step 1: org profile basics."""
    step: Literal["org"] = "org"
    org_name: str = Field(..., min_length=1, max_length=255)
    base_currency: str = Field(..., min_length=3, max_length=8)
    fiscal_year_start_month: int = Field(..., ge=1, le=12)

    @field_validator("org_name")
    @classmethod
    def _trim_org_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("org_name must not be empty")
        return trimmed

    @field_validator("base_currency")
    @classmethod
    def _validate_currency(cls, v: str) -> str:
        if not v.isalpha() or not v.isupper():
            raise ValueError("base_currency must be an upper-case alphabetic code (e.g. 'USD')")
        return v


class OnboardingStepPersonaPayload(_StateValidatingBase):
    """Step 2: persona radio choice."""
    step: Literal["persona"] = "persona"
    persona: Persona


class OnboardingStepDataPayload(_StateValidatingBase):
    """Step 3: how to start. One of seed_sample / import_csv / start_empty."""
    step: Literal["data"] = "data"
    choice: Literal["seed_sample", "import_csv", "start_empty"]


StepPayload = Annotated[
    OnboardingStepOrgPayload | OnboardingStepPersonaPayload | OnboardingStepDataPayload,
    Field(discriminator="step"),
]


# ----- Capture: the running state we mirror onto `orgs` -----


@dataclass(frozen=True)
class OnboardingCapture:
    """Server-side accumulator. Each step writes a subset of fields."""
    org_name: str | None = None
    base_currency: str | None = None
    fiscal_year_start_month: int | None = None
    persona: Persona | None = None
    data_choice: Literal["seed_sample", "import_csv", "start_empty"] | None = None


@dataclass(frozen=True)
class StepResult:
    """What the state machine returns after consuming a payload."""
    next_step: int
    completed: bool
    capture: OnboardingCapture
    # Set when the data step is consumed — drives the router's optional seed call.
    seed_sample_data: bool = False


# ----- Transitions -----


_STEP_NUMBER_TO_NAME = {1: "org", 2: "persona", 3: "data", 4: "done"}


def _expected_payload_kind(step: int) -> str | None:
    return _STEP_NUMBER_TO_NAME.get(step)


def next_step(
    *,
    current_step: int,
    capture: OnboardingCapture,
    payload: object,
) -> StepResult:
    """Consume a payload for `current_step` and return the next state.

    Steps 1–3 expect a typed payload; step 4 expects `None` and finalises.
    Any mismatch raises `StateValidationError`.
    """
    if current_step not in _STEP_NUMBER_TO_NAME:
        raise StateValidationError(f"unknown step {current_step}")

    expected = _expected_payload_kind(current_step)
    if current_step == 4:
        if payload is not None:
            raise StateValidationError("step 4 takes no payload")
        if not _capture_is_complete(capture):
            raise StateValidationError("cannot complete: required capture missing")
        return StepResult(next_step=4, completed=True, capture=capture)

    if payload is None:
        raise StateValidationError(f"step {current_step} requires a payload")
    if not hasattr(payload, "step") or payload.step != expected:
        raise StateValidationError(
            f"payload kind {getattr(payload, 'step', '?')!r} does not match step {current_step}"
        )

    if isinstance(payload, OnboardingStepOrgPayload):
        new_capture = replace(
            capture,
            org_name=payload.org_name,
            base_currency=payload.base_currency,
            fiscal_year_start_month=payload.fiscal_year_start_month,
        )
        return StepResult(next_step=2, completed=False, capture=new_capture)

    if isinstance(payload, OnboardingStepPersonaPayload):
        new_capture = replace(capture, persona=payload.persona)
        return StepResult(next_step=3, completed=False, capture=new_capture)

    if isinstance(payload, OnboardingStepDataPayload):
        new_capture = replace(capture, data_choice=payload.choice)
        return StepResult(
            next_step=4,
            completed=False,
            capture=new_capture,
            seed_sample_data=(payload.choice == "seed_sample"),
        )

    raise StateValidationError(f"unhandled payload type {type(payload).__name__}")


def _capture_is_complete(capture: OnboardingCapture) -> bool:
    return bool(
        capture.org_name
        and capture.base_currency
        and capture.fiscal_year_start_month is not None
        and capture.persona is not None
        and capture.data_choice is not None
    )


def derive_current_step(capture: OnboardingCapture) -> int:
    """Return the step the user should land on given what they've captured.

    Used by `GET /onboarding/state` to hydrate a resumed wizard. The frontend
    is free to override via the `?step=` query param, but this is the
    canonical answer.
    """
    if capture.org_name is None:
        return 1
    if capture.persona is None:
        return 2
    if capture.data_choice is None:
        return 3
    return 4
