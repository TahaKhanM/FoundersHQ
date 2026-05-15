"use client"

/**
 * Domain-scoped realtime hooks.
 *
 * Each ``use<Domain>Realtime`` hook subscribes to the SSE event types that
 * matter for one page family and invalidates the corresponding SWR keys.
 * A page mounts the hook once via its layout, and any in-tree component
 * using the matching ``useSWR(key, ...)`` will refetch on the next event.
 *
 * Wire contract: the string literals must match
 * ``backend/app/services/events/types.py`` exactly. The snapshot test
 * ``backend/tests/test_events_taxonomy.py`` pins the backend half; the
 * union below pins the frontend half.
 */
import { useSWRConfig } from "swr"

import { useRealtimeChannel } from "./hooks"

// ---------------------------------------------------------------------------
// Typed union of every event we currently subscribe to. Add a string here
// when the backend adds a new ``EventType`` member.
// ---------------------------------------------------------------------------

export type EventTypeString =
  // spending
  | "transaction.added"
  | "transaction.updated"
  | "transaction.categorized"
  | "categorization_rule.created"
  | "categorization_rule.updated"
  | "categorization_rule.deleted"
  | "commitment.updated"
  // invoices
  | "invoice.created"
  | "invoice.touch_logged"
  | "invoice.parsing_confirmed"
  // runway
  | "runway.forecast_computed"
  | "runway.scenario_created"
  | "runway.milestone_created"
  | "runway.milestone_updated"
  | "runway.milestone_deleted"
  // funding
  | "funding.opportunity_saved"
  // ingest
  | "ingest.job_enqueued"
  | "ingest.job_progress"
  | "questionnaire.saved"
  | "sample_data.seeded"
  // fx
  | "fx.rates_upserted"
  // auth/invitations/org
  | "auth.password_reset_requested"
  | "auth.password_reset_consumed"
  | "invitation.created"
  | "invitation.revoked"
  | "invitation.accepted"
  | "membership.role_changed"
  | "membership.removed"
  | "org.data_purged"
  // onboarding
  | "onboarding.step_completed"
  | "onboarding.completed"
  | "onboarding.sample_data_seeded"
  // notifications
  | "notification.created"
  | "notification.updated"
  | "notification_preference.updated"

// ---------------------------------------------------------------------------
// SWR key invalidator helper. Accepts string or array-prefixed keys; matches
// loose ``startsWith`` semantics on the first segment.
// ---------------------------------------------------------------------------

type MutateFn = (filter: (key: unknown) => boolean) => Promise<unknown>

function invalidateByPrefix(mutate: MutateFn, prefixes: string[]): void {
  void mutate((key) => {
    if (typeof key === "string") {
      return prefixes.some((p) => key.startsWith(p))
    }
    if (Array.isArray(key)) {
      const head = key[0]
      if (typeof head !== "string") return false
      return prefixes.some((p) => head.startsWith(p))
    }
    return false
  })
}

// ---------------------------------------------------------------------------
// Domain hooks. One subscribe-per-domain to keep the page surface small;
// listeners themselves are cheap (a Map entry + a closure).
// ---------------------------------------------------------------------------

/**
 * Spending domain: transactions, categorization rules, commitments,
 * alerts, metrics. The dashboard layout also mounts this so the headline
 * burn numbers update with new transactions.
 */
export function useSpendingRealtime(): void {
  const { mutate } = useSWRConfig()
  const refresh = () =>
    invalidateByPrefix(mutate, [
      "spending-metrics",
      "transactions",
      "categories",
      "rules",
      "commitments",
      "alerts",
      "dashboard-metrics",
      "dashboard-alerts",
    ])

  useRealtimeChannel<unknown>("transaction.added", refresh)
  useRealtimeChannel<unknown>("transaction.updated", refresh)
  useRealtimeChannel<unknown>("transaction.categorized", refresh)
  useRealtimeChannel<unknown>("categorization_rule.created", refresh)
  useRealtimeChannel<unknown>("categorization_rule.updated", refresh)
  useRealtimeChannel<unknown>("categorization_rule.deleted", refresh)
  useRealtimeChannel<unknown>("commitment.updated", refresh)
}

/**
 * Invoices domain: overview, list, action-queue, customers, touches.
 */
export function useInvoicesRealtime(): void {
  const { mutate } = useSWRConfig()
  const refresh = () =>
    invalidateByPrefix(mutate, [
      "invoice",
      "invoice-metrics",
      "invoices",
      "customers",
      "action-queue",
      "dashboard-metrics",
    ])

  useRealtimeChannel<unknown>("invoice.created", refresh)
  useRealtimeChannel<unknown>("invoice.touch_logged", refresh)
  useRealtimeChannel<unknown>("invoice.parsing_confirmed", refresh)
}

/**
 * Runway domain: forecast, milestones, scenarios.
 */
export function useRunwayRealtime(): void {
  const { mutate } = useSWRConfig()
  const refresh = () =>
    invalidateByPrefix(mutate, [
      "runway-forecast",
      "milestones",
      "scenarios",
      "dashboard-metrics",
    ])

  useRealtimeChannel<unknown>("runway.forecast_computed", refresh)
  useRealtimeChannel<unknown>("runway.scenario_created", refresh)
  useRealtimeChannel<unknown>("runway.milestone_created", refresh)
  useRealtimeChannel<unknown>("runway.milestone_updated", refresh)
  useRealtimeChannel<unknown>("runway.milestone_deleted", refresh)
}

/**
 * Funding domain: opportunities saved-status reflects in the timeline +
 * routes-rank view.
 */
export function useFundingRealtime(): void {
  const { mutate } = useSWRConfig()
  const refresh = () =>
    invalidateByPrefix(mutate, [
      "funding-routes",
      "funding-opportunities",
      "funding-timeline",
    ])

  useRealtimeChannel<unknown>("funding.opportunity_saved", refresh)
}

/**
 * Ingest domain: CSV imports and questionnaire. Surfaces progress bars
 * on the imports screen via ``ingest.job_progress`` (durable, so a tab
 * that reconnects mid-import catches up via the outbox replay).
 */
export function useIngestRealtime(): void {
  const { mutate } = useSWRConfig()
  const refresh = () =>
    invalidateByPrefix(mutate, [
      // Imports screen reads through the same hooks that drive spending +
      // invoice screens, so we invalidate broadly. The downstream `useSWR`
      // only refetches if the key is currently active.
      "transactions",
      "spending-metrics",
      "invoices",
      "invoice-metrics",
      "ingest-job",
    ])

  useRealtimeChannel<unknown>("ingest.job_enqueued", refresh)
  useRealtimeChannel<unknown>("ingest.job_progress", refresh)
  useRealtimeChannel<unknown>("questionnaire.saved", refresh)
  useRealtimeChannel<unknown>("sample_data.seeded", refresh)
}
