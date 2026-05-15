import useSWR from "swr"

import { apiFetch, IS_MOCK } from "../client"
import { mapAlert, mapDashboardMetrics } from "../mappers"
import type { AlertDTO, DashboardMetricsDTO } from "../types"
import { mockAlerts, mockDashboardMetrics } from "@/lib/mock/data"

const USE_MOCK = IS_MOCK

function mockFetcher<T>(data: T) {
  return async () => {
    await new Promise((r) => setTimeout(r, 300))
    return data
  }
}

export function useDashboardMetrics() {
  return useSWR<DashboardMetricsDTO>(
    "dashboard-metrics",
    USE_MOCK
      ? mockFetcher(mockDashboardMetrics)
      : async () => {
          const raw = await apiFetch<Record<string, unknown>>(
            "/dashboard/metrics",
          )
          return mapDashboardMetrics(raw)
        },
  )
}

export function useDashboardAlerts() {
  return useSWR<AlertDTO[]>(
    "dashboard-alerts",
    USE_MOCK
      ? mockFetcher(mockAlerts)
      : async () => {
          const raw = await apiFetch<Array<Record<string, unknown>>>(
            "/dashboard/alerts",
          )
          return (raw ?? []).map(mapAlert)
        },
  )
}
