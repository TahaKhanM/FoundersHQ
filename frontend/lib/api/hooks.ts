import useSWR from "swr"
import useSWRMutation from "swr/mutation"
import { apiFetch } from "./client"
import type {
  DashboardMetricsDTO,
  SpendingMetricsDTO,
  TransactionDTO,
  PaginatedResponse,
  CategorizationRuleDTO,
  CommitmentDTO,
  AlertDTO,
  CategoryDTO,
  InvoiceDTO,
  InvoiceMetricsDTO,
  CustomerDTO,
  ActionQueueItemDTO,
  RunwayForecastDTO,
  WeeklyForecastRowDTO,
  MilestoneDTO,
  FundingRouteDTO,
  FundingOpportunityDTO,
  FundingTimelineItemDTO,
  ImprovementItemDTO,
  LLMExplainResponseDTO,
} from "./types"
import {
  mockDashboardMetrics,
  mockSpendingMetrics,
  mockTransactions,
  mockRules,
  mockCommitments,
  mockAlerts,
  mockCategories,
  mockInvoices,
  mockInvoiceMetrics,
  mockCustomers,
  mockActionQueue,
  mockRunwayForecast,
  mockWeeklyForecast,
  mockMilestones,
  mockFundingRoutes,
  mockFundingOpportunities,
  mockFundingTimeline,
  mockImprovementChecklist,
} from "@/lib/mock/data"

// Always use mock mode in v0 environment
const IS_MOCK = true

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
  return useSWR<T>(key, IS_MOCK ? mockFetcher(mockData) : apiFetcher<T>(apiPath))
}

// =============================================
// Dashboard
// =============================================
export function useDashboardMetrics() {
  return useFetch<DashboardMetricsDTO>("dashboard-metrics", mockDashboardMetrics, "/dashboard/metrics")
}

export function useDashboardAlerts() {
  return useFetch<AlertDTO[]>("dashboard-alerts", mockAlerts, "/dashboard/alerts")
}

// =============================================
// Spending
// =============================================
export function useSpendingMetrics() {
  return useFetch<SpendingMetricsDTO>("spending-metrics", mockSpendingMetrics, "/spending/metrics")
}

export function useTransactions(params?: { page?: number; pageSize?: number; category?: string; search?: string }) {
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 10
  const key = `transactions-${page}-${pageSize}-${params?.category ?? ""}-${params?.search ?? ""}`

  return useSWR<PaginatedResponse<TransactionDTO>>(key, IS_MOCK ? async () => {
    await new Promise((r) => setTimeout(r, 300))
    let filtered = [...mockTransactions]
    if (params?.category) filtered = filtered.filter((t) => t.categoryId === params.category)
    if (params?.search) {
      const s = params.search.toLowerCase()
      filtered = filtered.filter((t) => t.merchant.toLowerCase().includes(s) || t.txnId.toLowerCase().includes(s))
    }
    const start = (page - 1) * pageSize
    return { data: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }
  } : apiFetcher<PaginatedResponse<TransactionDTO>>(`/spending/transactions?page=${page}&pageSize=${pageSize}`))
}

export function useCategories() {
  return useFetch<CategoryDTO[]>("categories", mockCategories, "/spending/categories")
}

export function useRules() {
  return useFetch<CategorizationRuleDTO[]>("rules", mockRules, "/spending/rules")
}

export function useCommitments() {
  return useFetch<CommitmentDTO[]>("commitments", mockCommitments, "/spending/commitments")
}

export function useAlerts() {
  return useFetch<AlertDTO[]>("alerts", mockAlerts, "/alerts")
}

// Mutation hooks
export function useUpdateTransactionCategory() {
  return useSWRMutation("transactions", async (_key: string, { arg }: { arg: { txnId: string; categoryId: string } }) => {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 300))
      return { success: true }
    }
    return apiFetch(`/spending/transactions/${arg.txnId}/category`, { method: "PATCH", body: JSON.stringify({ categoryId: arg.categoryId }) })
  })
}

export function useCreateRule() {
  return useSWRMutation("rules", async (_key: string, { arg }: { arg: Omit<CategorizationRuleDTO, "ruleId" | "createdAt"> }) => {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 300))
      return { ...arg, ruleId: `rule_${Date.now()}`, createdAt: new Date().toISOString() }
    }
    return apiFetch("/spending/rules", { method: "POST", body: JSON.stringify(arg) })
  })
}

// =============================================
// Invoices
// =============================================
export function useInvoiceMetrics() {
  return useFetch<InvoiceMetricsDTO>("invoice-metrics", mockInvoiceMetrics, "/invoices/metrics")
}

export function useInvoices(params?: { page?: number; pageSize?: number; status?: string; customerId?: string }) {
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 10
  const key = `invoices-${page}-${pageSize}-${params?.status ?? ""}-${params?.customerId ?? ""}`

  return useSWR<PaginatedResponse<InvoiceDTO>>(key, IS_MOCK ? async () => {
    await new Promise((r) => setTimeout(r, 300))
    let filtered = [...mockInvoices]
    if (params?.status) filtered = filtered.filter((i) => i.status === params.status)
    if (params?.customerId) filtered = filtered.filter((i) => i.customerId === params.customerId)
    const start = (page - 1) * pageSize
    return { data: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }
  } : apiFetcher<PaginatedResponse<InvoiceDTO>>(`/invoices?page=${page}&pageSize=${pageSize}`))
}

export function useCustomers() {
  return useFetch<CustomerDTO[]>("customers", mockCustomers, "/invoices/customers")
}

export function useCustomer(customerId: string) {
  return useSWR<CustomerDTO>(`customer-${customerId}`, IS_MOCK ? async () => {
    await new Promise((r) => setTimeout(r, 300))
    return mockCustomers.find((c) => c.customerId === customerId) ?? mockCustomers[0]
  } : apiFetcher<CustomerDTO>(`/invoices/customers/${customerId}`))
}

export function useActionQueue() {
  return useFetch<ActionQueueItemDTO[]>("action-queue", mockActionQueue, "/invoices/actions")
}

export function useLogTouch() {
  return useSWRMutation("action-queue", async (_key: string, { arg }: { arg: { invoiceId: string; channel: string; notes?: string } }) => {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 300))
      return { touchId: `touch_${Date.now()}`, ...arg, createdAt: new Date().toISOString() }
    }
    return apiFetch("/invoices/touches", { method: "POST", body: JSON.stringify(arg) })
  })
}

// =============================================
// Runway
// =============================================
export function useRunwayForecast() {
  return useFetch<RunwayForecastDTO>("runway-forecast", mockRunwayForecast, "/runway/forecast")
}

export function useWeeklyForecast() {
  return useFetch<WeeklyForecastRowDTO[]>("weekly-forecast", mockWeeklyForecast, "/runway/weekly")
}

export function useMilestones() {
  return useFetch<MilestoneDTO[]>("milestones", mockMilestones, "/runway/milestones")
}

export function useApplyScenario() {
  return useSWRMutation("runway-forecast", async (_key: string, { arg }: { arg: Record<string, unknown> }) => {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 500))
      return mockRunwayForecast
    }
    return apiFetch<RunwayForecastDTO>("/runway/scenario", { method: "POST", body: JSON.stringify(arg) })
  })
}

// =============================================
// Funding
// =============================================
export function useFundingRoutes() {
  return useFetch<FundingRouteDTO[]>("funding-routes", mockFundingRoutes, "/funding/routes")
}

export function useFundingOpportunities() {
  return useFetch<FundingOpportunityDTO[]>("funding-opportunities", mockFundingOpportunities, "/funding/opportunities")
}

export function useFundingTimeline() {
  return useFetch<FundingTimelineItemDTO[]>("funding-timeline", mockFundingTimeline, "/funding/timeline")
}

export function useImprovementChecklist() {
  return useFetch<ImprovementItemDTO[]>("improvement-checklist", mockImprovementChecklist, "/funding/improvements")
}

// =============================================
// LLM
// =============================================
export function useLLMExplain() {
  return useSWRMutation("llm-explain", async (_key: string, { arg }: { arg: { question: string; contextModules: string[] } }) => {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 1200))
      const response: LLMExplainResponseDTO = {
        answer: `Based on your financial data, here's what I found:\n\nYour net burn of $42,500/month is primarily driven by payroll (txn_001: $28,500) and cloud infrastructure (txn_002: $4,200). The SaaS tool category shows an 8.3% month-over-month increase.\n\nOn the revenue side, you have $58,000 in outstanding invoices, with $18,500 overdue. The most concerning is inv_003 from Beta Inc ($12,000, 34 days overdue) which is significantly impacting your cash position.\n\nYour pessimistic runway of 11 weeks suggests urgency in either reducing costs or accelerating collections. I recommend prioritizing the Beta Inc collection (inv_003) and reviewing cloud costs (txn_002) for optimization.`,
        citations: [
          { evidenceIds: ["txn_001", "txn_002"], note: "Primary burn drivers" },
          { evidenceIds: ["inv_003", "inv_005"], note: "Overdue invoices" },
        ],
        confidence: "high",
        disclaimers: ["Projections based on last 30 days of data. Actual results may vary."],
      }
      return response
    }
    return apiFetch<LLMExplainResponseDTO>("/llm/explain", { method: "POST", body: JSON.stringify(arg) })
  })
}
