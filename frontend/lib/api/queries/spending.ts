import useSWR from "swr"
import useSWRMutation from "swr/mutation"

import { apiFetch, IS_MOCK } from "../client"
import {
  mapAlert,
  mapCategory,
  mapCommitment,
  mapPaginatedTransactions,
  mapRule,
  mapSpendingMetrics,
  mapTransaction,
} from "../mappers"
import type {
  AlertDTO,
  CategorizationRuleDTO,
  CategoryDTO,
  CommitmentDTO,
  PaginatedResponse,
  SpendingMetricsDTO,
  TransactionDTO,
} from "../types"
import {
  mockAlerts,
  mockCategories,
  mockCommitments,
  mockRules,
  mockSpendingMetrics,
  mockTransactions,
} from "@/lib/mock/data"

const USE_MOCK = IS_MOCK

function mockFetcher<T>(data: T) {
  return async () => {
    await new Promise((r) => setTimeout(r, 300))
    return data
  }
}

export function useSpendingMetrics() {
  return useSWR<SpendingMetricsDTO>(
    "spending-metrics",
    USE_MOCK
      ? mockFetcher(mockSpendingMetrics)
      : async () => {
          const raw = await apiFetch<Record<string, unknown>>(
            "/spending/metrics",
          )
          return mapSpendingMetrics(raw)
        },
  )
}

export function useTransactions(params?: {
  page?: number
  pageSize?: number
  category?: string
  search?: string
}) {
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 10
  const key = `transactions-${page}-${pageSize}-${params?.category ?? ""}-${params?.search ?? ""}`

  return useSWR<PaginatedResponse<TransactionDTO>>(
    key,
    USE_MOCK
      ? async () => {
          await new Promise((r) => setTimeout(r, 300))
          let filtered = [...mockTransactions]
          if (params?.category)
            filtered = filtered.filter((t) => t.categoryId === params.category)
          if (params?.search) {
            const s = params.search.toLowerCase()
            filtered = filtered.filter(
              (t) =>
                t.merchant.toLowerCase().includes(s) ||
                t.txnId.toLowerCase().includes(s),
            )
          }
          const start = (page - 1) * pageSize
          return {
            data: filtered.slice(start, start + pageSize),
            total: filtered.length,
            page,
            pageSize,
          }
        }
      : async () => {
          const raw = await apiFetch<Record<string, unknown>>(
            `/spending/transactions?page=${page}&page_size=${pageSize}`,
          )
          return mapPaginatedTransactions(raw)
        },
  )
}

export function useCategories() {
  return useSWR<CategoryDTO[]>(
    "categories",
    USE_MOCK
      ? mockFetcher(mockCategories)
      : async () => {
          const raw = await apiFetch<Array<Record<string, unknown>>>(
            "/spending/categories",
          )
          return (raw ?? []).map(mapCategory)
        },
  )
}

export function useRules() {
  return useSWR<CategorizationRuleDTO[]>(
    "rules",
    USE_MOCK
      ? mockFetcher(mockRules)
      : async () => {
          const raw = await apiFetch<Array<Record<string, unknown>>>(
            "/spending/rules",
          )
          return (raw ?? []).map(mapRule)
        },
  )
}

export function useCommitments() {
  return useSWR<CommitmentDTO[]>(
    "commitments",
    USE_MOCK
      ? mockFetcher(mockCommitments)
      : async () => {
          const raw = await apiFetch<Array<Record<string, unknown>>>(
            "/spending/commitments",
          )
          return (raw ?? []).map(mapCommitment)
        },
  )
}

export function useAlerts() {
  return useSWR<AlertDTO[]>(
    "alerts",
    USE_MOCK
      ? mockFetcher(mockAlerts)
      : async () => {
          const raw = await apiFetch<Array<Record<string, unknown>>>(
            "/spending/alerts",
          )
          return (raw ?? []).map(mapAlert)
        },
  )
}

export function useTransaction(txnId: string | null) {
  return useSWR<TransactionDTO | null>(
    txnId && !USE_MOCK ? ["transaction", txnId] : null,
    async () => {
      if (!txnId) return null
      const raw = await apiFetch<Record<string, unknown>>(
        `/spending/transactions/${txnId}`,
      )
      return mapTransaction(raw)
    },
  )
}

export function useUpdateTransactionCategory() {
  return useSWRMutation(
    "transactions",
    async (
      _key: string,
      { arg }: { arg: { txnId: string; categoryId: string } },
    ) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 300))
        return { success: true }
      }
      return apiFetch(`/spending/transactions/${arg.txnId}`, {
        method: "PATCH",
        body: JSON.stringify({ category_id: arg.categoryId }),
      })
    },
  )
}

export function useCreateRule() {
  return useSWRMutation(
    "rules",
    async (
      _key: string,
      { arg }: { arg: Omit<CategorizationRuleDTO, "ruleId" | "createdAt"> },
    ) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 300))
        return {
          ...arg,
          ruleId: `rule_${Date.now()}`,
          createdAt: new Date().toISOString(),
        }
      }
      return apiFetch("/spending/rules", {
        method: "POST",
        body: JSON.stringify(arg),
      })
    },
  )
}
