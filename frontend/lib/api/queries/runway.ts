import useSWR from "swr"
import useSWRMutation from "swr/mutation"

import { apiFetch, IS_MOCK } from "../client"
import type {
  MilestoneDTO,
  RunwayForecastDTO,
  WeeklyForecastRowDTO,
} from "../types"
import {
  mockMilestones,
  mockRunwayForecast,
  mockWeeklyForecast,
} from "@/lib/mock/data"

const USE_MOCK = IS_MOCK

function mockFetcher<T>(data: T) {
  return async () => {
    await new Promise((r) => setTimeout(r, 300))
    return data
  }
}

function apiFetcher<T>(path: string) {
  return async () => apiFetch<T>(path)
}

function useFetch<T>(key: string, mockData: T, apiPath: string) {
  return useSWR<T>(key, USE_MOCK ? mockFetcher(mockData) : apiFetcher<T>(apiPath))
}

export function useRunwayForecast() {
  return useFetch<RunwayForecastDTO>(
    "runway-forecast",
    mockRunwayForecast,
    "/runway/forecast",
  )
}

export function useWeeklyForecast() {
  return useFetch<WeeklyForecastRowDTO[]>(
    "weekly-forecast",
    mockWeeklyForecast,
    "/runway/weekly",
  )
}

export function useMilestones() {
  return useFetch<MilestoneDTO[]>(
    "milestones",
    mockMilestones,
    "/runway/milestones",
  )
}

export function useApplyScenario() {
  return useSWRMutation(
    "runway-forecast",
    async (_key: string, { arg }: { arg: Record<string, unknown> }) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 500))
        return mockRunwayForecast
      }
      return apiFetch<RunwayForecastDTO>("/runway/scenario", {
        method: "POST",
        body: JSON.stringify(arg),
      })
    },
  )
}
