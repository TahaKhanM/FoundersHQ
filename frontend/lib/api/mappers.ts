/**
 * Map backend API responses (snake_case) to frontend DTOs (camelCase).
 * Used when NEXT_PUBLIC_MOCK_API=false.
 */

import type {
  SpendingMetricsDTO,
  TransactionDTO,
  PaginatedResponse,
  InvoiceDTO,
  InvoiceMetricsDTO,
  CustomerDTO,
  AlertDTO,
  DashboardMetricsDTO,
  CategoryDTO,
  CategorizationRuleDTO,
  CommitmentDTO,
} from "./types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BackendSpendingMetrics = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BackendTransaction = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BackendInvoice = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BackendCustomer = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BackendAlert = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BackendDashboardMetrics = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BackendPaginated = Record<string, any>

export function mapSpendingMetrics(raw: BackendSpendingMetrics): SpendingMetricsDTO {
  const rec = raw.reconciliation
  return {
    totalOutflow30d: Number(raw.total_outflow_30d ?? raw.totalOutflow30d ?? 0),
    netBurn30d: Number(raw.net_burn_30d ?? raw.netBurn30d ?? 0),
    runRateOutflow: Number(raw.run_rate_outflow ?? raw.runRateOutflow ?? 0),
    spendCreepPct: Number(raw.spend_creep_pct ?? raw.spendCreepPct ?? 0),
    cashWeeks: raw.cash_weeks != null ? Number(raw.cash_weeks) : (raw.cashWeeks != null ? Number(raw.cashWeeks) : 0),
    bufferRatio: raw.buffer_ratio != null ? Number(raw.buffer_ratio) : (raw.bufferRatio != null ? Number(raw.bufferRatio) : 0),
    revenueBreakevenGap: Number(raw.revenue_breakeven_gap ?? raw.revenueBreakevenGap ?? 0),
    updatedAt: raw.updated_at ?? raw.updatedAt ?? new Date().toISOString(),
    reconciliation: rec
      ? {
          weekly_outflow_series: rec.weekly_outflow_series ?? [],
          period_outflow_total: Number(rec.period_outflow_total ?? 0),
          sum_of_weekly_totals: Number(rec.sum_of_weekly_totals ?? 0),
          mismatch: Boolean(rec.mismatch),
          mismatch_note: rec.mismatch_note ?? rec.mismatchNote ?? null,
        }
      : undefined,
  }
}

export function mapTransaction(raw: BackendTransaction): TransactionDTO {
  return {
    txnId: String(raw.id ?? raw.txnId ?? ""),
    date: raw.txn_date ?? raw.date ?? "",
    merchant: raw.merchant_raw ?? raw.merchant ?? "",
    canonicalMerchant: raw.merchant_canonical ?? raw.canonicalMerchant ?? raw.merchant ?? "",
    amount: Number(raw.amount ?? 0),
    currency: String(raw.currency ?? "USD"),
    categoryId: raw.category_id ?? raw.categoryId ?? "",
    categoryName: raw.category_name ?? raw.categoryName ?? "",
    source: String(raw.source ?? "csv"),
    createdAt: raw.created_at ?? raw.createdAt ?? "",
  }
}

export function mapPaginatedTransactions(raw: BackendPaginated): PaginatedResponse<TransactionDTO> {
  const items = raw.items ?? raw.data ?? []
  return {
    data: items.map((i: BackendTransaction) => mapTransaction(i)),
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? 1),
    pageSize: Number(raw.page_size ?? raw.pageSize ?? 10),
  }
}

export function mapInvoice(raw: BackendInvoice): InvoiceDTO {
  const due = raw.due_date ?? raw.dueDate
  const today = new Date().toISOString().slice(0, 10)
  const dueStr = typeof due === "string" ? due.slice(0, 10) : ""
  const daysOverdue =
    dueStr && raw.status !== "paid" && today > dueStr
      ? Math.floor((Date.parse(today) - Date.parse(dueStr)) / 86400000)
      : 0
  return {
    invoiceId: String(raw.id ?? raw.invoiceId ?? ""),
    customerId: String(raw.customer_id ?? raw.customerId ?? ""),
    customerName: raw.customer_name ?? raw.customerName ?? "",
    amount: Number(raw.amount ?? 0),
    currency: String(raw.currency ?? "USD"),
    issueDate: raw.issue_date ?? raw.issueDate ?? "",
    dueDate: dueStr || (raw.due_date ?? raw.dueDate ?? ""),
    paidDate: raw.paid_date ?? raw.paidDate,
    status: (raw.status ?? "open") as "open" | "overdue" | "paid",
    daysOverdue,
    expectedPayDateBase: raw.expected_pay_date_base ?? raw.expectedPayDateBase,
    expectedPayDatePess: raw.expected_pay_date_pess ?? raw.expectedPayDatePess,
    confidenceTier: (raw.confidence_tier ?? raw.confidenceTier ?? "medium") as "high" | "medium" | "low",
    riskScore: Number(raw.risk_score ?? raw.riskScore ?? 0),
    lastContactedAt: raw.last_contacted_at ?? raw.lastContactedAt,
  }
}

export function mapPaginatedInvoices(raw: BackendPaginated): PaginatedResponse<InvoiceDTO> {
  const items = raw.items ?? raw.data ?? []
  return {
    data: items.map((i: BackendInvoice) => mapInvoice(i)),
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? 1),
    pageSize: Number(raw.page_size ?? raw.pageSize ?? 10),
  }
}

export function mapInvoiceMetricsFromOverview(raw: {
  total_open?: number | string
  total_overdue?: number | string
  count_open?: number
  count_overdue?: number
  ageing_buckets?: Record<string, number | string>
  expected_cash_in_series?: Array<{ amount_base?: number; amount_pess?: number }>
}): InvoiceMetricsDTO {
  const open = Number(raw.total_open ?? 0)
  const overdue = Number(raw.total_overdue ?? 0)
  const countOpen = Number(raw.count_open ?? 0)
  const countOverdue = Number(raw.count_overdue ?? 0)
  const overdueRatio = countOpen > 0 ? countOverdue / countOpen : 0
  const series = raw.expected_cash_in_series ?? []
  const expectedBase = series.length > 0 ? Number(series[0]?.amount_base ?? 0) : 0
  const expectedPess = series.length > 0 ? Number(series[0]?.amount_pess ?? 0) : 0
  const buckets = raw.ageing_buckets ?? {}
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0))
  return {
    outstanding: open,
    overdue,
    overdueRatio,
    expectedCashInBase: expectedBase,
    expectedCashInPess: expectedPess,
    ageingBuckets: {
      "0-7": num(buckets["0-7"] ?? 0),
      "8-30": num(buckets["8-30"] ?? buckets["0-30"] ?? 0),
      "31-60": num(buckets["31-60"] ?? 0),
      "60+": num(buckets["60+"] ?? buckets["61-90"] ?? buckets["90+"] ?? 0),
    },
  }
}

export function mapCustomer(raw: BackendCustomer): CustomerDTO {
  return {
    customerId: String(raw.id ?? raw.customerId ?? ""),
    name: String(raw.name_raw ?? raw.name ?? ""),
    onTimeRate: Number(raw.on_time_rate ?? raw.onTimeRate ?? 0),
    medianDelayDays: Number(raw.median_delay_days ?? raw.medianDelayDays ?? 0),
    p90DelayDays: Number(raw.p90_delay_days ?? raw.p90DelayDays ?? 0),
    exposureOpenAmount: Number(raw.exposure_open_amount ?? raw.exposureOpenAmount ?? 0),
    exposureOverdueAmount: Number(raw.exposure_overdue_amount ?? raw.exposureOverdueAmount ?? 0),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCategory(raw: Record<string, any>): CategoryDTO {
  return {
    categoryId: String(raw.id ?? raw.categoryId ?? ""),
    name: String(raw.name ?? ""),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRule(raw: Record<string, any>): CategorizationRuleDTO {
  return {
    ruleId: String(raw.id ?? raw.ruleId ?? ""),
    pattern: String(raw.pattern ?? ""),
    matchType: (raw.match_type ?? raw.matchType ?? "contains") as "contains" | "regex",
    categoryId: String(raw.category_id ?? raw.categoryId ?? ""),
    enabled: Boolean(raw.enabled ?? true),
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCommitment(raw: Record<string, any>): CommitmentDTO {
  return {
    commitmentId: String(raw.id ?? raw.commitmentId ?? ""),
    merchant: String(raw.merchant_canonical ?? raw.merchant ?? ""),
    frequency: (raw.frequency ?? "monthly") as "weekly" | "monthly" | "quarterly" | "annual",
    typicalAmount: Number(raw.typical_amount ?? raw.typicalAmount ?? 0),
    nextDueDate: raw.next_due_date ?? raw.nextDueDate ?? "",
    confidence: Number(raw.confidence ?? 0),
    enabled: Boolean(raw.enabled ?? true),
  }
}

export function mapAlert(raw: BackendAlert): AlertDTO {
  return {
    alertId: String(raw.id ?? raw.alertId ?? ""),
    type: (raw.type ?? "info") as AlertDTO["type"],
    severity: (raw.severity ?? "info") as "critical" | "warning" | "info",
    title: String(raw.title ?? ""),
    description: String(raw.message ?? raw.description ?? ""),
    message: raw.message ?? raw.description,
    evidenceIds: Array.isArray(raw.evidence_ids) ? raw.evidence_ids : (raw.evidenceIds ?? []),
    nextStepTitle: raw.next_step_title ?? raw.nextStepTitle ?? null,
    deepLink: raw.deep_link ?? raw.deepLink ?? null,
  }
}

export function mapDashboardMetrics(raw: BackendDashboardMetrics): DashboardMetricsDTO {
  return {
    cashWeeks: Number(raw.cash_weeks ?? raw.cashWeeks ?? 0),
    netBurn30d: Number(raw.net_burn_30d ?? raw.netBurn30d ?? 0),
    totalOutflow30d: Number(raw.total_outflow_30d ?? raw.totalOutflow30d ?? 0),
    spendCreepStatus: (raw.spend_creep_status ?? raw.spendCreepStatus ?? "stable") as "rising" | "stable" | "declining",
    overdueRatio: Number(raw.overdue_ratio ?? raw.overdueRatio ?? 0),
    runwayBase: Number(raw.runway_base ?? raw.runwayBase ?? 0),
    runwayPess: Number(raw.runway_pess ?? raw.runwayPess ?? 0),
  }
}
