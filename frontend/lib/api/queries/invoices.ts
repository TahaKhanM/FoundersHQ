import useSWR from "swr"
import useSWRMutation from "swr/mutation"

import { apiFetch, IS_MOCK } from "../client"
import {
  mapCustomer,
  mapInvoice,
  mapInvoiceMetricsFromOverview,
  mapPaginatedInvoices,
} from "../mappers"
import type {
  ActionQueueItemDTO,
  CustomerDTO,
  InvoiceDTO,
  InvoiceMetricsDTO,
  PaginatedResponse,
} from "../types"
import {
  mockActionQueue,
  mockCustomers,
  mockInvoiceMetrics,
  mockInvoices,
} from "@/lib/mock/data"

const USE_MOCK = IS_MOCK

function mockFetcher<T>(data: T) {
  return async () => {
    await new Promise((r) => setTimeout(r, 300))
    return data
  }
}

export function useInvoiceDetail(invoiceId: string | null) {
  return useSWR<InvoiceDTO | null>(
    invoiceId && !USE_MOCK ? ["invoice", invoiceId] : null,
    async () => {
      if (!invoiceId) return null
      const raw = await apiFetch<Record<string, unknown>>(
        `/invoices/${invoiceId}`,
      )
      return mapInvoice(raw)
    },
  )
}

export function useInvoiceMetrics() {
  return useSWR<InvoiceMetricsDTO>(
    "invoice-metrics",
    USE_MOCK
      ? mockFetcher(mockInvoiceMetrics)
      : async () => {
          const raw = await apiFetch<Record<string, unknown>>(
            "/invoices/overview",
          )
          return mapInvoiceMetricsFromOverview(raw)
        },
  )
}

export function useInvoices(params?: {
  page?: number
  pageSize?: number
  status?: string
  customerId?: string
}) {
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 10
  const key = `invoices-${page}-${pageSize}-${params?.status ?? ""}-${params?.customerId ?? ""}`

  return useSWR<PaginatedResponse<InvoiceDTO>>(
    key,
    USE_MOCK
      ? async () => {
          await new Promise((r) => setTimeout(r, 300))
          let filtered = [...mockInvoices]
          if (params?.status)
            filtered = filtered.filter((i) => i.status === params.status)
          if (params?.customerId)
            filtered = filtered.filter(
              (i) => i.customerId === params.customerId,
            )
          const start = (page - 1) * pageSize
          return {
            data: filtered.slice(start, start + pageSize),
            total: filtered.length,
            page,
            pageSize,
          }
        }
      : async () => {
          const sp = new URLSearchParams()
          sp.set("page", String(page))
          sp.set("page_size", String(pageSize))
          if (params?.status) sp.set("status", params.status)
          const raw = await apiFetch<Record<string, unknown>>(
            `/invoices?${sp.toString()}`,
          )
          return mapPaginatedInvoices(raw)
        },
  )
}

export function useCustomers() {
  return useSWR<CustomerDTO[]>(
    "customers",
    USE_MOCK
      ? mockFetcher(mockCustomers)
      : async () => {
          const raw = await apiFetch<Record<string, unknown>>(
            "/customers?page=1&page_size=500",
          )
          const items = (raw?.items ?? raw?.data ?? []) as Array<
            Record<string, unknown>
          >
          return items.map(mapCustomer)
        },
  )
}

export function useCustomer(customerId: string) {
  return useSWR<CustomerDTO>(
    `customer-${customerId}`,
    USE_MOCK
      ? async () => {
          await new Promise((r) => setTimeout(r, 300))
          return (
            mockCustomers.find((c) => c.customerId === customerId) ??
            mockCustomers[0]
          )
        }
      : async () => {
          const raw = await apiFetch<Record<string, unknown>>(
            `/customers/${customerId}`,
          )
          return mapCustomer(raw)
        },
  )
}

export function useActionQueue() {
  return useSWR<ActionQueueItemDTO[]>(
    "action-queue",
    USE_MOCK
      ? mockFetcher(mockActionQueue)
      : async () => {
          const raw = await apiFetch<Array<Record<string, unknown>>>(
            "/invoices/action-queue",
          )
          return (raw || []).map((item: Record<string, unknown>) => ({
            actionId: String(item.invoice_id ?? item.invoiceId ?? ""),
            invoiceId: String(item.invoice_id ?? item.invoiceId ?? ""),
            customerId: "",
            customerName: String(item.customer_name ?? ""),
            actionType: mapSuggestedActionToType(
              String(item.suggested_action ?? "reminder"),
            ),
            dueAt: String(item.due_date ?? item.dueAt ?? ""),
            dueDate: item.due_date != null ? String(item.due_date) : undefined,
            priorityScore: Number(
              item.priority_score ?? item.priorityScore ?? 0,
            ),
            reasons: item.reasons ? (item.reasons as string[]) : [],
            evidenceIds: Array.isArray(item.evidence_ids)
              ? (item.evidence_ids as string[])
              : [],
            lastTouchedAt:
              item.last_touched_at != null
                ? String(item.last_touched_at)
                : null,
            lastTouchType:
              item.last_touch_type != null
                ? String(item.last_touch_type)
                : null,
            isCompleted: Boolean(item.is_completed ?? item.isCompleted),
            amount: item.amount != null ? Number(item.amount) : undefined,
            daysOverdue:
              item.days_overdue != null ? Number(item.days_overdue) : undefined,
          }))
        },
  )
}

function mapSuggestedActionToType(
  suggested: string,
): "reminder" | "call" | "escalation" {
  if (suggested === "reminder") return "reminder"
  if (suggested === "escalation" || suggested === "escalation_urgent")
    return "escalation"
  return "call"
}

export function useLogTouch() {
  return useSWRMutation(
    "action-queue",
    async (
      _key: string,
      {
        arg,
      }: {
        arg: {
          invoiceId: string
          channel: string
          touchType?: string
          notes?: string
        }
      },
    ) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 300))
        return {
          touchId: `touch_${Date.now()}`,
          ...arg,
          createdAt: new Date().toISOString(),
        }
      }
      const touchType =
        arg.touchType ?? (arg.channel === "email" ? "reminder" : "escalation")
      return apiFetch("/invoices/touches", {
        method: "POST",
        body: JSON.stringify({
          invoice_id: arg.invoiceId,
          channel: arg.channel,
          touch_type: touchType,
          notes: arg.notes ?? null,
        }),
      })
    },
  )
}
