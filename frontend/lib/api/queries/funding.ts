import useSWR from "swr"

import { apiFetch, IS_MOCK } from "../client"
import type {
  FundingOpportunityDTO,
  FundingRouteDTO,
  FundingTimelineItemDTO,
  ImprovementItemDTO,
} from "../types"
import {
  mockFundingOpportunities,
  mockFundingRoutes,
  mockFundingTimeline,
  mockImprovementChecklist,
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

export function useFundingRoutes() {
  return useFetch<FundingRouteDTO[]>(
    "funding-routes",
    mockFundingRoutes,
    "/funding/routes",
  )
}

export function useFundingOpportunities() {
  return useFetch<FundingOpportunityDTO[]>(
    "funding-opportunities",
    mockFundingOpportunities,
    "/funding/opportunities",
  )
}

export function useFundingTimeline() {
  return useFetch<FundingTimelineItemDTO[]>(
    "funding-timeline",
    mockFundingTimeline,
    "/funding/timeline",
  )
}

export function useImprovementChecklist() {
  return useFetch<ImprovementItemDTO[]>(
    "improvement-checklist",
    mockImprovementChecklist,
    "/funding/improvements",
  )
}
