/**
 * Phase 1.B: onboarding wizard hooks.
 *
 * SWR-keyed by `/onboarding/state`. Mutations are explicit async functions
 * that callers `await` and then revalidate via `useOnboardingMutate`.
 * Mock mode returns an in-memory state machine so the wizard works without
 * the backend (NEXT_PUBLIC_MOCK_API=true).
 */
import useSWR, { useSWRConfig } from "swr"

import { apiFetch, IS_MOCK } from "../client"

export type Persona =
  | "founder_operator"
  | "first_time_founder"
  | "second_time_founder"
  | "ops_finance_lead"

export type DataChoice = "seed_sample" | "import_csv" | "start_empty"

export interface OnboardingCaptureDTO {
  orgName: string | null
  baseCurrency: string | null
  fiscalYearStartMonth: number | null
  persona: Persona | null
  dataChoice: DataChoice | null
}

export interface OnboardingStateDTO {
  step: number
  completedAt: string | null
  captured: OnboardingCaptureDTO
}

export interface OnboardingCompleteResponseDTO {
  completedAt: string
  org: { id: string; name: string }
}

export interface OnboardingSeedSampleResponseDTO {
  transactionsInserted: number
  invoicesInserted: number
  customersInserted: number
  commitmentsInserted: number
}

interface BackendCapture {
  org_name: string | null
  base_currency: string | null
  fiscal_year_start_month: number | null
  persona: string | null
  data_choice: string | null
}

interface BackendState {
  step: number
  completed_at: string | null
  captured: BackendCapture
}

interface BackendComplete {
  completed_at: string
  org: { id: string; name: string }
}

interface BackendSeed {
  transactions_inserted: number
  invoices_inserted: number
  customers_inserted: number
  commitments_inserted: number
}

function mapState(b: BackendState): OnboardingStateDTO {
  return {
    step: b.step,
    completedAt: b.completed_at,
    captured: {
      orgName: b.captured.org_name,
      baseCurrency: b.captured.base_currency,
      fiscalYearStartMonth: b.captured.fiscal_year_start_month,
      persona: (b.captured.persona as Persona | null) ?? null,
      dataChoice: (b.captured.data_choice as DataChoice | null) ?? null,
    },
  }
}

// ---- Mock state (module-scoped: persists for the page session) ----

const MOCK_STATE: OnboardingStateDTO = {
  step: 1,
  completedAt: null,
  captured: {
    orgName: null,
    baseCurrency: null,
    fiscalYearStartMonth: null,
    persona: null,
    dataChoice: null,
  },
}

// ---- Public hooks ----

export function useOnboardingState() {
  return useSWR<OnboardingStateDTO>(
    "/onboarding/state",
    IS_MOCK
      ? async () => ({ ...MOCK_STATE, captured: { ...MOCK_STATE.captured } })
      : async () => mapState(await apiFetch<BackendState>("/onboarding/state")),
  )
}

export interface StepOrgPayload {
  step: "org"
  orgName: string
  baseCurrency: string
  fiscalYearStartMonth: number
}

export interface StepPersonaPayload {
  step: "persona"
  persona: Persona
}

export interface StepDataPayload {
  step: "data"
  choice: DataChoice
}

export type StepPayload = StepOrgPayload | StepPersonaPayload | StepDataPayload

function toBackend(payload: StepPayload): Record<string, unknown> {
  switch (payload.step) {
    case "org":
      return {
        step: "org",
        org_name: payload.orgName,
        base_currency: payload.baseCurrency,
        fiscal_year_start_month: payload.fiscalYearStartMonth,
      }
    case "persona":
      return { step: "persona", persona: payload.persona }
    case "data":
      return { step: "data", choice: payload.choice }
  }
}

export async function submitOnboardingStep(
  n: number,
  payload: StepPayload,
): Promise<OnboardingStateDTO> {
  if (IS_MOCK) {
    switch (payload.step) {
      case "org":
        MOCK_STATE.captured.orgName = payload.orgName
        MOCK_STATE.captured.baseCurrency = payload.baseCurrency
        MOCK_STATE.captured.fiscalYearStartMonth = payload.fiscalYearStartMonth
        MOCK_STATE.step = 2
        break
      case "persona":
        MOCK_STATE.captured.persona = payload.persona
        MOCK_STATE.step = 3
        break
      case "data":
        MOCK_STATE.captured.dataChoice = payload.choice
        MOCK_STATE.step = 4
        break
    }
    return { ...MOCK_STATE, captured: { ...MOCK_STATE.captured } }
  }
  const raw = await apiFetch<BackendState>(`/onboarding/step/${n}`, {
    method: "POST",
    body: JSON.stringify(toBackend(payload)),
  })
  return mapState(raw)
}

export async function completeOnboarding(): Promise<OnboardingCompleteResponseDTO> {
  if (IS_MOCK) {
    MOCK_STATE.completedAt = new Date().toISOString()
    MOCK_STATE.step = 4
    return {
      completedAt: MOCK_STATE.completedAt,
      org: { id: "mock-org", name: MOCK_STATE.captured.orgName ?? "Demo Org" },
    }
  }
  const raw = await apiFetch<BackendComplete>("/onboarding/complete", {
    method: "POST",
  })
  return { completedAt: raw.completed_at, org: raw.org }
}

export async function seedSampleData(): Promise<OnboardingSeedSampleResponseDTO> {
  if (IS_MOCK) {
    return {
      transactionsInserted: 10,
      invoicesInserted: 5,
      customersInserted: 2,
      commitmentsInserted: 2,
    }
  }
  const raw = await apiFetch<BackendSeed>("/onboarding/seed-sample-data", {
    method: "POST",
  })
  return {
    transactionsInserted: raw.transactions_inserted,
    invoicesInserted: raw.invoices_inserted,
    customersInserted: raw.customers_inserted,
    commitmentsInserted: raw.commitments_inserted,
  }
}

export function useOnboardingMutate() {
  const { mutate } = useSWRConfig()
  return {
    refresh: () => mutate("/onboarding/state"),
  }
}
