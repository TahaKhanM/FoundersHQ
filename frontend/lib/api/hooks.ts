import useSWR from "swr"
import useSWRMutation from "swr/mutation"
import { apiFetch, IS_MOCK } from "./client"
import {
  mapSpendingMetrics,
  mapPaginatedTransactions,
  mapTransaction,
  mapPaginatedInvoices,
  mapInvoiceMetricsFromOverview,
  mapCustomer,
  mapAlert,
  mapDashboardMetrics,
  mapCategory,
  mapRule,
  mapCommitment,
} from "./mappers"
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
  SearchResultDTO,
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

// Mock switch: use env so backend can be used when NEXT_PUBLIC_MOCK_API is not "true"
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

// =============================================
// Dashboard
// =============================================
export function useDashboardMetrics() {
  return useSWR<DashboardMetricsDTO>(
    "dashboard-metrics",
    USE_MOCK
      ? mockFetcher(mockDashboardMetrics)
      : async () => {
          const raw = await apiFetch<Record<string, unknown>>("/dashboard/metrics")
          return mapDashboardMetrics(raw)
        }
  )
}

export function useDashboardAlerts() {
  return useSWR<AlertDTO[]>(
    "dashboard-alerts",
    USE_MOCK
      ? mockFetcher(mockAlerts)
      : async () => {
          const raw = await apiFetch<Array<Record<string, unknown>>>("/dashboard/alerts")
          return (raw ?? []).map(mapAlert)
        }
  )
}

// =============================================
// Spending
// =============================================
export function useSpendingMetrics() {
  return useSWR<SpendingMetricsDTO>(
    "spending-metrics",
    USE_MOCK
      ? mockFetcher(mockSpendingMetrics)
      : async () => {
          const raw = await apiFetch<Record<string, unknown>>("/spending/metrics")
          return mapSpendingMetrics(raw)
        }
  )
}

export function useTransactions(params?: { page?: number; pageSize?: number; category?: string; search?: string }) {
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 10
  const key = `transactions-${page}-${pageSize}-${params?.category ?? ""}-${params?.search ?? ""}`

  return useSWR<PaginatedResponse<TransactionDTO>>(
    key,
    USE_MOCK
      ? async () => {
          await new Promise((r) => setTimeout(r, 300))
          let filtered = [...mockTransactions]
          if (params?.category) filtered = filtered.filter((t) => t.categoryId === params.category)
          if (params?.search) {
            const s = params.search.toLowerCase()
            filtered = filtered.filter((t) => t.merchant.toLowerCase().includes(s) || t.txnId.toLowerCase().includes(s))
          }
          const start = (page - 1) * pageSize
          return { data: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }
        }
      : async () => {
          const raw = await apiFetch<Record<string, unknown>>(
            `/spending/transactions?page=${page}&page_size=${pageSize}`
          )
          return mapPaginatedTransactions(raw)
        }
  )
}

export function useCategories() {
  return useSWR<CategoryDTO[]>(
    "categories",
    USE_MOCK
      ? mockFetcher(mockCategories)
      : async () => {
          const raw = await apiFetch<Array<Record<string, unknown>>>("/spending/categories")
          return (raw ?? []).map(mapCategory)
        }
  )
}

export function useRules() {
  return useSWR<CategorizationRuleDTO[]>(
    "rules",
    USE_MOCK
      ? mockFetcher(mockRules)
      : async () => {
          const raw = await apiFetch<Array<Record<string, unknown>>>("/spending/rules")
          return (raw ?? []).map(mapRule)
        }
  )
}

export function useCommitments() {
  return useSWR<CommitmentDTO[]>(
    "commitments",
    USE_MOCK
      ? mockFetcher(mockCommitments)
      : async () => {
          const raw = await apiFetch<Array<Record<string, unknown>>>("/spending/commitments")
          return (raw ?? []).map(mapCommitment)
        }
  )
}

export function useAlerts() {
  return useSWR<AlertDTO[]>(
    "alerts",
    USE_MOCK
      ? mockFetcher(mockAlerts)
      : async () => {
          const raw = await apiFetch<Array<Record<string, unknown>>>("/spending/alerts")
          return (raw ?? []).map(mapAlert)
        }
  )
}

export function useTransaction(txnId: string | null) {
  return useSWR<TransactionDTO | null>(
    txnId && !USE_MOCK ? ["transaction", txnId] : null,
    async () => {
      if (!txnId) return null
      const raw = await apiFetch<Record<string, unknown>>(`/spending/transactions/${txnId}`)
      return mapTransaction(raw)
    }
  )
}

export function useInvoiceDetail(invoiceId: string | null) {
  return useSWR<InvoiceDTO | null>(
    invoiceId && !USE_MOCK ? ["invoice", invoiceId] : null,
    async () => {
      if (!invoiceId) return null
      const raw = await apiFetch<Record<string, unknown>>(`/invoices/${invoiceId}`)
      return mapInvoice(raw)
    }
  )
}

// Mutation hooks
export function useUpdateTransactionCategory() {
  return useSWRMutation("transactions", async (_key: string, { arg }: { arg: { txnId: string; categoryId: string } }) => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 300))
      return { success: true }
    }
    return apiFetch(`/spending/transactions/${arg.txnId}`, { method: "PATCH", body: JSON.stringify({ category_id: arg.categoryId }) })
  })
}

export function useCreateRule() {
  return useSWRMutation("rules", async (_key: string, { arg }: { arg: Omit<CategorizationRuleDTO, "ruleId" | "createdAt"> }) => {
    if (USE_MOCK) {
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
  return useSWR<InvoiceMetricsDTO>(
    "invoice-metrics",
    USE_MOCK
      ? mockFetcher(mockInvoiceMetrics)
      : async () => {
          const raw = await apiFetch<Record<string, unknown>>("/invoices/overview")
          return mapInvoiceMetricsFromOverview(raw)
        }
  )
}

export function useInvoices(params?: { page?: number; pageSize?: number; status?: string; customerId?: string }) {
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 10
  const key = `invoices-${page}-${pageSize}-${params?.status ?? ""}-${params?.customerId ?? ""}`

  return useSWR<PaginatedResponse<InvoiceDTO>>(
    key,
    USE_MOCK
      ? async () => {
          await new Promise((r) => setTimeout(r, 300))
          let filtered = [...mockInvoices]
          if (params?.status) filtered = filtered.filter((i) => i.status === params.status)
          if (params?.customerId) filtered = filtered.filter((i) => i.customerId === params.customerId)
          const start = (page - 1) * pageSize
          return { data: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }
        }
      : async () => {
          const sp = new URLSearchParams()
          sp.set("page", String(page))
          sp.set("page_size", String(pageSize))
          if (params?.status) sp.set("status", params.status)
          const raw = await apiFetch<Record<string, unknown>>(`/invoices?${sp.toString()}`)
          return mapPaginatedInvoices(raw)
        }
  )
}

export function useCustomers() {
  return useSWR<CustomerDTO[]>(
    "customers",
    USE_MOCK
      ? mockFetcher(mockCustomers)
      : async () => {
          const raw = await apiFetch<Record<string, unknown>>("/customers?page=1&page_size=500")
          const items = (raw?.items ?? raw?.data ?? []) as Array<Record<string, unknown>>
          return items.map(mapCustomer)
        }
  )
}

export function useCustomer(customerId: string) {
  return useSWR<CustomerDTO>(
    `customer-${customerId}`,
    USE_MOCK
      ? async () => {
          await new Promise((r) => setTimeout(r, 300))
          return mockCustomers.find((c) => c.customerId === customerId) ?? mockCustomers[0]
        }
      : async () => {
          const raw = await apiFetch<Record<string, unknown>>(`/customers/${customerId}`)
          return mapCustomer(raw)
        }
  )
}

export function useActionQueue() {
  return useSWR<ActionQueueItemDTO[]>(
    "action-queue",
    USE_MOCK
      ? mockFetcher(mockActionQueue)
      : async () => {
          const raw = await apiFetch<Array<Record<string, unknown>>>("/invoices/action-queue")
          return (raw || []).map((item: Record<string, unknown>) => ({
            actionId: String(item.invoice_id ?? item.invoiceId ?? ""),
            invoiceId: String(item.invoice_id ?? item.invoiceId ?? ""),
            customerId: "",
            customerName: String(item.customer_name ?? ""),
            actionType: mapSuggestedActionToType(String(item.suggested_action ?? "reminder")),
            dueAt: String(item.due_date ?? item.dueAt ?? ""),
            dueDate: item.due_date != null ? String(item.due_date) : undefined,
            priorityScore: Number(item.priority_score ?? item.priorityScore ?? 0),
            reasons: item.reasons ? (item.reasons as string[]) : [],
            evidenceIds: Array.isArray(item.evidence_ids) ? (item.evidence_ids as string[]) : [],
            lastTouchedAt: item.last_touched_at != null ? String(item.last_touched_at) : null,
            lastTouchType: item.last_touch_type != null ? String(item.last_touch_type) : null,
            isCompleted: Boolean(item.is_completed ?? item.isCompleted),
            amount: item.amount != null ? Number(item.amount) : undefined,
            daysOverdue: item.days_overdue != null ? Number(item.days_overdue) : undefined,
          }))
        }
  )
}

function mapSuggestedActionToType(suggested: string): "reminder" | "call" | "escalation" {
  if (suggested === "reminder") return "reminder"
  if (suggested === "escalation" || suggested === "escalation_urgent") return "escalation"
  return "call"
}

export function useLogTouch() {
  return useSWRMutation("action-queue", async (_key: string, { arg }: { arg: { invoiceId: string; channel: string; touchType?: string; notes?: string } }) => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 300))
      return { touchId: `touch_${Date.now()}`, ...arg, createdAt: new Date().toISOString() }
    }
    const touchType = arg.touchType ?? (arg.channel === "email" ? "reminder" : "escalation")
    return apiFetch("/invoices/touches", {
      method: "POST",
      body: JSON.stringify({
        invoice_id: arg.invoiceId,
        channel: arg.channel,
        touch_type: touchType,
        notes: arg.notes ?? null,
      }),
    })
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
    if (USE_MOCK) {
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
// Global Search
// =============================================
export function useGlobalSearch(query: string | null, enabled: boolean = true) {
  const shouldFetch = Boolean(query && enabled && !USE_MOCK)
  return useSWR<SearchResultDTO[]>(
    shouldFetch ? ["global-search", query] : null,
    async () => {
      const q = encodeURIComponent(query!)
      const raw = await apiFetch<SearchResultDTO[]>(`/search?q=${q}&limit=20`)
      return Array.isArray(raw) ? raw : []
    },
    { revalidateOnFocus: false, dedupingInterval: 300 }
  )
}

// =============================================
// LLM
// =============================================
export function useLLMExplain() {
  return useSWRMutation("llm-explain", async (_key: string, { arg }: { arg: { question: string; contextModules: string[] } }) => {
    if (USE_MOCK) {
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
