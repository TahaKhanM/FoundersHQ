"""Snapshot test of the ``EventType`` enum.

This is the load-bearing wire contract between the backend producers and the
frontend consumers. Adding a new event type is fine; renaming or removing
one breaks every subscribed hook. The snapshot below pins the set so any
change forces a deliberate update here (and a matching frontend hook).
"""
from __future__ import annotations

from app.services.events import EventType
from app.services.events.types import ALL_EVENT_TYPES

# Frozen wire snapshot. If you change one of these strings, you have broken
# the contract with every browser tab currently subscribed. Bump the
# frontend ``domain-hooks.ts`` literal in the same commit.
EXPECTED: dict[str, str] = {
    # transactions / spending
    "TRANSACTION_ADDED": "transaction.added",
    "TRANSACTION_UPDATED": "transaction.updated",
    "TRANSACTION_CATEGORIZED": "transaction.categorized",
    "CATEGORIZATION_RULE_CREATED": "categorization_rule.created",
    "CATEGORIZATION_RULE_UPDATED": "categorization_rule.updated",
    "CATEGORIZATION_RULE_DELETED": "categorization_rule.deleted",
    "COMMITMENT_UPDATED": "commitment.updated",
    # invoices
    "INVOICE_CREATED": "invoice.created",
    "INVOICE_TOUCH_LOGGED": "invoice.touch_logged",
    "INVOICE_PARSING_CONFIRMED": "invoice.parsing_confirmed",
    # runway
    "RUNWAY_FORECAST_COMPUTED": "runway.forecast_computed",
    "RUNWAY_SCENARIO_CREATED": "runway.scenario_created",
    "RUNWAY_MILESTONE_CREATED": "runway.milestone_created",
    "RUNWAY_MILESTONE_UPDATED": "runway.milestone_updated",
    "RUNWAY_MILESTONE_DELETED": "runway.milestone_deleted",
    # funding
    "FUNDING_OPPORTUNITY_SAVED": "funding.opportunity_saved",
    # ingest
    "INGEST_JOB_ENQUEUED": "ingest.job_enqueued",
    "INGEST_JOB_PROGRESS": "ingest.job_progress",
    "QUESTIONNAIRE_SAVED": "questionnaire.saved",
    "SAMPLE_DATA_SEEDED": "sample_data.seeded",
    # fx
    "FX_RATES_UPSERTED": "fx.rates_upserted",
    # auth
    "AUTH_PASSWORD_RESET_REQUESTED": "auth.password_reset_requested",
    "AUTH_PASSWORD_RESET_CONSUMED": "auth.password_reset_consumed",
    # invitations / org
    "INVITATION_CREATED": "invitation.created",
    "INVITATION_REVOKED": "invitation.revoked",
    "INVITATION_ACCEPTED": "invitation.accepted",
    "MEMBERSHIP_ROLE_CHANGED": "membership.role_changed",
    "MEMBERSHIP_REMOVED": "membership.removed",
    "ORG_DATA_PURGED": "org.data_purged",
    # onboarding
    "ONBOARDING_STEP_COMPLETED": "onboarding.step_completed",
    "ONBOARDING_COMPLETED": "onboarding.completed",
    "ONBOARDING_SAMPLE_DATA_SEEDED": "onboarding.sample_data_seeded",
    # notifications
    "NOTIFICATION_UPDATED": "notification.updated",
    "NOTIFICATION_PREFERENCE_UPDATED": "notification_preference.updated",
}


def test_event_type_snapshot_matches_expected():
    """Every member name maps to its expected string value."""
    actual = {name: member.value for name, member in EventType.__members__.items()}
    assert actual == EXPECTED, (
        "EventType snapshot drift. Update tests/test_events_taxonomy.py + "
        "frontend/lib/realtime/domain-hooks.ts in the same commit."
    )


def test_all_event_types_includes_every_member():
    """The exported list mirrors the enum (used for FE consumption)."""
    assert set(ALL_EVENT_TYPES) == {m.value for m in EventType}
    # Sorted for deterministic snapshots in clients.
    assert sorted(ALL_EVENT_TYPES) == ALL_EVENT_TYPES


def test_event_type_values_are_dot_namespaced():
    """We rely on ``domain.action`` shapes for client routing."""
    for member in EventType:
        assert "." in member.value, f"{member.name} missing dot separator"
        domain, action = member.value.split(".", 1)
        assert domain.replace("_", "").isalpha(), member.value
        assert action.replace("_", "").isalpha(), member.value


def test_event_type_values_are_unique():
    values = [m.value for m in EventType]
    assert len(values) == len(set(values))
