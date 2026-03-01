/**
 * Insights domain: list + dismiss.
 *
 * The inbox combines insights with notifications in a single visual stream
 * (see ``app/(shell)/inbox/page.tsx``). Hooks here live under the
 * ``/insights`` key prefix so a bulk mutate-on-event pattern can target
 * both domains with a single ``mutate((key) => key.startsWith(...))``.
 *
 * In mock mode we serve a tiny deck so the inbox is browsable without a
 * running backend. The mock list mirrors the real DTO shape exactly.
 */
import useSWR, { useSWRConfig } from "swr"

import { apiFetch, IS_MOCK } from "../client"
import { mapInsight } from "../mappers"
import type { InsightDTO, InsightStatus } from "../types"

export type InsightListStatus = "active" | "dismissed" | "all"

interface BackendInsightListResponse {
  items: Array<Record<string, unknown>>
  next_cursor: string | null
}

// ---------------------------------------------------------------------------
// Mock fixtures
// ---------------------------------------------------------------------------

const MOCK_INSIGHTS: InsightDTO[] = [
  {
    id: "mock-i-1",
    orgId: "mock-org",
    type: "cash_drop",
    severity: "warn",
    title: "Cash dropped 32% week-over-week",
    body: "Ending cash fell from 95,000 to 64,000. Top outflows attached.",
    evidenceIds: [],
    status: "active",
    deepLink: "/runway",
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    dismissedAt: null,
  },
  {
    id: "mock-i-2",
    orgId: "mock-org",
    type: "late_invoice",
    severity: "critical",
    title: "Globex invoice is overdue",
    body:
      "Globex's invoice for 18,500 was due 2026-05-14 (2 days overdue).",
    evidenceIds: ["inv-globex-1"],
    status: "active",
    deepLink: "/invoices",
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    dismissedAt: null,
  },
  {
    id: "mock-i-3",
    orgId: "mock-org",
    type: "commitment_renewal",
    severity: "warn",
    title: "AWS monthly renewal in 5 days",
    body: "AWS (monthly) is due to charge 4,200 on 2026-05-21.",
    evidenceIds: ["cmt-aws"],
    status: "active",
    deepLink: "/spending",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    dismissedAt: null,
  },
]

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

const KEY_LIST = (status: InsightListStatus) => `/insights?status=${status}`
const KEY_COUNT = "/insights/count"

export function useInsights(status: InsightListStatus = "active", limit = 50) {
  return useSWR<InsightDTO[]>(
    [KEY_LIST(status), limit],
    IS_MOCK
      ? async () => {
          if (status === "active") {
            return MOCK_INSIGHTS.filter((i) => i.status === "active")
          }
          if (status === "dismissed") {
            return MOCK_INSIGHTS.filter((i) => i.status === "dismissed")
          }
          return MOCK_INSIGHTS
        }
      : async () => {
          const raw = await apiFetch<BackendInsightListResponse>(
            `/insights?status=${status}&limit=${limit}`,
          )
          return (raw?.items ?? []).map(mapInsight)
        },
  )
}

/**
 * Convenience hook for the bell badge — returns just the count of active
 * insights. Implemented client-side so the backend doesn't need a separate
 * count endpoint; the active list is already small.
 */
export function useActiveInsightCount() {
  const { data, ...rest } = useInsights("active", 100)
  return {
    ...rest,
    data: data ? data.length : 0,
  }
}

/**
 * Dismiss a single insight. Mock mode flips the in-memory deck.
 */
export async function dismissInsight(id: string): Promise<InsightDTO> {
  if (IS_MOCK) {
    const found = MOCK_INSIGHTS.find((i) => i.id === id)
    if (found) {
      found.status = "dismissed" as InsightStatus
      found.dismissedAt = new Date().toISOString()
    }
    return found ?? MOCK_INSIGHTS[0]
  }
  const raw = await apiFetch<Record<string, unknown>>(
    `/insights/${id}/dismiss`,
    { method: "POST" },
  )
  return mapInsight(raw)
}

/**
 * Same shape as ``useNotificationsMutate``: a single ``refreshAll`` that
 * blasts every insight SWR key, plus a status-scoped refresh.
 */
export function useInsightsMutate() {
  const { mutate } = useSWRConfig()
  return {
    refreshAll: () => {
      void mutate((key) => typeof key === "string" && key.startsWith("/insights"))
      void mutate(
        (key) =>
          Array.isArray(key) &&
          typeof key[0] === "string" &&
          key[0].startsWith("/insights"),
      )
    },
    refreshList: (status: InsightListStatus) =>
      mutate((key) => Array.isArray(key) && key[0] === KEY_LIST(status)),
  }
}

export const INSIGHT_TYPE_LABELS: Record<string, string> = {
  cash_drop: "Cash drop",
  late_invoice: "Late invoice",
  vendor_spike: "Vendor spike",
  commitment_renewal: "Commitment renewal",
  runway_change: "Runway change",
}

export type { InsightDTO } from "../types"
