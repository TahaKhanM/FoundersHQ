// =============================================
// Auth
// =============================================
export interface UserDTO {
  id: string
  email: string
  orgId: string
}

export interface SessionDTO {
  user: UserDTO
  tokenExpiresAt: string
}

// =============================================
// Spending
// =============================================
export interface TransactionDTO {
  txnId: string
  date: string
  merchant: string
  canonicalMerchant: string
  amount: number
  currency: string
  categoryId: string
  categoryName: string
  source: string
  createdAt: string
}

export interface CategoryDTO {
  categoryId: string
  name: string
}

export interface CategorizationRuleDTO {
  ruleId: string
  pattern: string
  matchType: "contains" | "regex"
  categoryId: string
  enabled: boolean
  createdAt: string
}

export interface CommitmentDTO {
  commitmentId: string
  merchant: string
  frequency: "weekly" | "monthly" | "quarterly" | "annual"
  typicalAmount: number
  nextDueDate: string
  confidence: number
  enabled: boolean
}

export interface SpendingMetricsDTO {
  totalOutflow30d: number
  netBurn30d: number
  runRateOutflow: number
  spendCreepPct: number
  cashWeeks: number
  bufferRatio: number
  revenueBreakevenGap: number
  updatedAt: string
  reconciliation?: {
    weekly_outflow_series: Array<{ week_start?: string; total_outflow: number }>
    period_outflow_total: number
    sum_of_weekly_totals: number
    mismatch: boolean
    mismatch_note?: string | null
  }
}

export interface AlertDTO {
  alertId: string
  type: "spend_creep" | "overdue_invoice" | "runway_crash" | "high_burn" | "commitment_spike"
  severity: "critical" | "warning" | "info"
  title: string
  description: string
  message?: string
  evidenceIds: string[]
  nextStepTitle?: string | null
  deepLink?: string | null
}

// =============================================
// Invoices
// =============================================
export interface InvoiceDTO {
  invoiceId: string
  customerId: string
  customerName: string
  amount: number
  currency: string
  issueDate: string
  dueDate: string
  paidDate?: string
  status: "open" | "overdue" | "paid"
  daysOverdue: number
  expectedPayDateBase?: string
  expectedPayDatePess?: string
  confidenceTier: "high" | "medium" | "low"
  riskScore: number
  lastContactedAt?: string
}

export interface CustomerDTO {
  customerId: string
  name: string
  onTimeRate: number
  medianDelayDays: number
  p90DelayDays: number
  exposureOpenAmount: number
  exposureOverdueAmount: number
}

export interface ActionQueueItemDTO {
  actionId: string
  invoiceId: string
  customerId: string
  customerName?: string
  actionType: "reminder" | "call" | "escalation"
  dueAt: string
  dueDate?: string
  priorityScore: number
  reasons: string[]
  template?: string
  evidenceIds: string[]
  lastTouchedAt?: string | null
  lastTouchType?: string | null
  isCompleted?: boolean
  amount?: number
  daysOverdue?: number
}

export interface TouchLogDTO {
  touchId: string
  invoiceId: string
  channel: string
  notes?: string
  createdAt: string
}

// =============================================
// Runway
// =============================================
export interface RunwaySeriesPointDTO {
  weekStart: string
  cashBase: number
  cashPess: number
  flags: string[]
  evidenceIds: string[]
}

export interface RunwayForecastDTO {
  forecastId: string
  generatedAt: string
  horizonWeeks: number
  crashWeekBase?: string
  crashWeekPess?: string
  cashWeeksBase: number
  cashWeeksPess: number
  series: RunwaySeriesPointDTO[]
}

export interface WeeklyForecastRowDTO {
  weekStart: string
  startingCash: number
  inflows: number
  outflows: number
  endingCash: number
  components?: Record<string, number>
  evidenceIds: string[]
  notes?: string
}

export interface ScenarioDTO {
  scenarioId: string
  name: string
  params: Record<string, unknown>
  createdAt: string
}

export interface MilestoneDTO {
  milestoneId: string
  name: string
  targetType: "cash" | "runway" | "revenue"
  targetValue: number
  targetWeekStart: string
  statusBase: "on_track" | "off_track"
  statusPess: "on_track" | "off_track"
}

// =============================================
// Funding
// =============================================
export interface FundingRouteDTO {
  routeId: string
  name: string
  fitScore: number
  breakdown: {
    eligibility: number
    speed: number
    costRisk: number
    control: number
    riskCompatibility: number
  }
  whyBullets: string[]
  warnings: string[]
  requirements: string[]
}

export interface FundingOpportunityDTO {
  opportunityId: string
  name: string
  provider: string
  type: string
  geography: string
  amountMin: number
  amountMax: number
  deadline?: string
  tags: string[]
  lastUpdatedAt: string
  parseConfidence: number
}

export interface FundingTimelineItemDTO {
  stepId: string
  title: string
  recommendedByDate: string
  rationale: string
  relatedOpportunityIds: string[]
}

export interface ImprovementItemDTO {
  itemId: string
  title: string
  description: string
  linkedModule: "spending" | "invoices" | "runway" | "funding"
  targetEvidenceIds?: string[]
  done: boolean
}

// =============================================
// LLM
// =============================================
export interface LLMExplainRequestDTO {
  question: string
  contextModules: string[]
  orgId?: string
  conversationId?: string
}

export interface LLMExplainResponseDTO {
  answer: string
  citations: { evidenceIds: string[]; note?: string }[]
  confidence: "high" | "medium" | "low"
  disclaimers: string[]
}

// =============================================
// Search (global search from backend)
// =============================================
export interface SearchResultDTO {
  type: string
  id: string
  title: string
  subtitle?: string | null
  snippet?: string | null
  deep_link: string
  open_param?: string | null
  score: number
  match_reason: string
}

// =============================================
// Paginated response
// =============================================
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// =============================================
// Dashboard
// =============================================
export interface DashboardMetricsDTO {
  cashWeeks: number
  netBurn30d: number
  totalOutflow30d: number
  spendCreepStatus: "rising" | "stable" | "declining"
  overdueRatio: number
  runwayBase: number
  runwayPess: number
}

// =============================================
// Invoice Metrics
// =============================================
export interface InvoiceMetricsDTO {
  outstanding: number
  overdue: number
  overdueRatio: number
  expectedCashInBase: number
  expectedCashInPess: number
  ageingBuckets: {
    "0-7": number
    "8-30": number
    "31-60": number
    "60+": number
  }
}
