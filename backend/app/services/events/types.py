"""Catalogue of event-type strings emitted by the backend.

Adding a new event type:

1. Add a new ``EventType`` member here.
2. Pin its value in ``backend/tests/test_events_taxonomy.py`` (the snapshot
   forces a deliberate update so reviewers see the contract change).
3. Subscribe to it in ``frontend/lib/realtime/domain-hooks.ts``.

Renaming or removing a member breaks every browser tab currently
subscribed; do not do it without a migration plan.

The values are stable strings of the form ``domain.action`` (snake-case).
``EventType`` is a ``StrEnum`` so the values can be passed directly to
``publish_event`` / ``publish_event_best_effort`` without an explicit
``.value`` access.
"""
from __future__ import annotations

from enum import StrEnum


class EventType(StrEnum):
    """Every event type the backend publishes.

    Members are grouped by domain. Frontend hooks subscribe to one
    ``domain.*`` slice at a time — see ``frontend/lib/realtime/domain-hooks.ts``.
    """

    # --- transactions / spending ----------------------------------------
    TRANSACTION_ADDED = "transaction.added"
    TRANSACTION_UPDATED = "transaction.updated"
    TRANSACTION_CATEGORIZED = "transaction.categorized"
    CATEGORIZATION_RULE_CREATED = "categorization_rule.created"
    CATEGORIZATION_RULE_UPDATED = "categorization_rule.updated"
    CATEGORIZATION_RULE_DELETED = "categorization_rule.deleted"
    COMMITMENT_UPDATED = "commitment.updated"

    # --- invoices --------------------------------------------------------
    INVOICE_CREATED = "invoice.created"
    INVOICE_TOUCH_LOGGED = "invoice.touch_logged"
    INVOICE_PARSING_CONFIRMED = "invoice.parsing_confirmed"

    # --- runway ---------------------------------------------------------
    RUNWAY_FORECAST_COMPUTED = "runway.forecast_computed"
    RUNWAY_SCENARIO_CREATED = "runway.scenario_created"
    RUNWAY_MILESTONE_CREATED = "runway.milestone_created"
    RUNWAY_MILESTONE_UPDATED = "runway.milestone_updated"
    RUNWAY_MILESTONE_DELETED = "runway.milestone_deleted"

    # --- funding --------------------------------------------------------
    FUNDING_OPPORTUNITY_SAVED = "funding.opportunity_saved"

    # --- ingest ---------------------------------------------------------
    INGEST_JOB_ENQUEUED = "ingest.job_enqueued"
    INGEST_JOB_PROGRESS = "ingest.job_progress"
    QUESTIONNAIRE_SAVED = "questionnaire.saved"
    SAMPLE_DATA_SEEDED = "sample_data.seeded"

    # --- fx -------------------------------------------------------------
    FX_RATES_UPSERTED = "fx.rates_upserted"

    # --- auth -----------------------------------------------------------
    AUTH_PASSWORD_RESET_REQUESTED = "auth.password_reset_requested"
    AUTH_PASSWORD_RESET_CONSUMED = "auth.password_reset_consumed"

    # --- invitations / org ---------------------------------------------
    INVITATION_CREATED = "invitation.created"
    INVITATION_REVOKED = "invitation.revoked"
    INVITATION_ACCEPTED = "invitation.accepted"
    MEMBERSHIP_ROLE_CHANGED = "membership.role_changed"
    MEMBERSHIP_REMOVED = "membership.removed"
    ORG_DATA_PURGED = "org.data_purged"

    # --- onboarding -----------------------------------------------------
    ONBOARDING_STEP_COMPLETED = "onboarding.step_completed"
    ONBOARDING_COMPLETED = "onboarding.completed"
    ONBOARDING_SAMPLE_DATA_SEEDED = "onboarding.sample_data_seeded"

    # --- notifications --------------------------------------------------
    NOTIFICATION_UPDATED = "notification.updated"
    NOTIFICATION_PREFERENCE_UPDATED = "notification_preference.updated"


# Sorted snapshot for clients that prefer a plain list (e.g. the test
# taxonomy + the frontend's typed union). Keep sorted so the taxonomy
# snapshot remains stable under member reordering.
ALL_EVENT_TYPES: list[str] = sorted(member.value for member in EventType)


__all__ = ["EventType", "ALL_EVENT_TYPES"]
