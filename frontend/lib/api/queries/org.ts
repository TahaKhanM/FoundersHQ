/**
 * `/org` query hook.
 *
 * Returns the calling user's first-membership org. Phase 2.C wires this so
 * `BaseCurrencyProvider` can hydrate the org's `base_currency`. SWR-keyed on
 * `org` so the dedupe window is shared across the tree.
 */
import useSWR from "swr"

import { apiFetch, IS_MOCK } from "../client"

export interface OrgDTO {
  id: string
  name: string
  createdAt: string | null
  baseCurrency: string
  fiscalYearStartMonth: number
}

interface BackendOrg {
  id: string
  name: string
  created_at: string | null
  base_currency?: string
  fiscal_year_start_month?: number
}

function mapOrg(raw: BackendOrg): OrgDTO {
  return {
    id: raw.id,
    name: raw.name,
    createdAt: raw.created_at,
    baseCurrency: raw.base_currency ?? "USD",
    fiscalYearStartMonth: raw.fiscal_year_start_month ?? 1,
  }
}

async function fetchOrgReal(): Promise<OrgDTO> {
  const raw = await apiFetch<BackendOrg>("/org")
  return mapOrg(raw)
}

async function fetchOrgMock(): Promise<OrgDTO> {
  // Mock mode default: USD; a fixture org wouldn't surface here anyway.
  return {
    id: "mock-org",
    name: "Mock Org",
    createdAt: new Date(0).toISOString(),
    baseCurrency: "USD",
    fiscalYearStartMonth: 1,
  }
}

export function useOrg() {
  return useSWR<OrgDTO>("org", IS_MOCK ? fetchOrgMock : fetchOrgReal)
}
