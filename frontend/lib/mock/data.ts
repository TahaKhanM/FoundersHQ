import type {
  AlertDTO,
  TransactionDTO,
  CategoryDTO,
  CategorizationRuleDTO,
  CommitmentDTO,
  SpendingMetricsDTO,
  DashboardMetricsDTO,
  InvoiceDTO,
  CustomerDTO,
  ActionQueueItemDTO,
  InvoiceMetricsDTO,
  RunwayForecastDTO,
  WeeklyForecastRowDTO,
  MilestoneDTO,
  FundingRouteDTO,
  FundingOpportunityDTO,
  FundingTimelineItemDTO,
  ImprovementItemDTO,
} from "@/lib/api/types"

// =============================================
// Categories
// =============================================
export const mockCategories: CategoryDTO[] = [
  { categoryId: "cat_01", name: "Payroll" },
  { categoryId: "cat_02", name: "SaaS Tools" },
  { categoryId: "cat_03", name: "Cloud & Infra" },
  { categoryId: "cat_04", name: "Marketing" },
  { categoryId: "cat_05", name: "Office & Admin" },
  { categoryId: "cat_06", name: "Professional Services" },
  { categoryId: "cat_07", name: "Travel" },
  { categoryId: "cat_08", name: "Revenue" },
]

// =============================================
// Dashboard Metrics
// =============================================
export const mockDashboardMetrics: DashboardMetricsDTO = {
  cashWeeks: 14.2,
  netBurn30d: -42500,
  totalOutflow30d: 67800,
  spendCreepStatus: "rising",
  overdueRatio: 0.23,
  runwayBase: 18,
  runwayPess: 11,
}

// =============================================
// Spending Metrics
// =============================================
export const mockSpendingMetrics: SpendingMetricsDTO = {
  totalOutflow30d: 67800,
  netBurn30d: -42500,
  runRateOutflow: 72100,
  spendCreepPct: 8.3,
  cashWeeks: 14.2,
  bufferRatio: 2.1,
  revenueBreakevenGap: -17200,
  updatedAt: "2026-02-28T10:00:00Z",
}

// =============================================
// Transactions
// =============================================
export const mockTransactions: TransactionDTO[] = [
  { txnId: "txn_001", date: "2026-02-27", merchant: "Gusto Payroll", canonicalMerchant: "Gusto", amount: -28500, currency: "USD", categoryId: "cat_01", categoryName: "Payroll", source: "csv", createdAt: "2026-02-27T08:00:00Z" },
  { txnId: "txn_002", date: "2026-02-25", merchant: "AWS", canonicalMerchant: "Amazon Web Services", amount: -4200, currency: "USD", categoryId: "cat_03", categoryName: "Cloud & Infra", source: "csv", createdAt: "2026-02-25T09:30:00Z" },
  { txnId: "txn_003", date: "2026-02-24", merchant: "Notion", canonicalMerchant: "Notion Labs", amount: -480, currency: "USD", categoryId: "cat_02", categoryName: "SaaS Tools", source: "csv", createdAt: "2026-02-24T10:00:00Z" },
  { txnId: "txn_004", date: "2026-02-23", merchant: "Stripe Deposit", canonicalMerchant: "Stripe", amount: 12500, currency: "USD", categoryId: "cat_08", categoryName: "Revenue", source: "csv", createdAt: "2026-02-23T14:00:00Z" },
  { txnId: "txn_005", date: "2026-02-22", merchant: "Google Ads", canonicalMerchant: "Google", amount: -3200, currency: "USD", categoryId: "cat_04", categoryName: "Marketing", source: "csv", createdAt: "2026-02-22T11:00:00Z" },
  { txnId: "txn_006", date: "2026-02-20", merchant: "WeWork", canonicalMerchant: "WeWork", amount: -2400, currency: "USD", categoryId: "cat_05", categoryName: "Office & Admin", source: "csv", createdAt: "2026-02-20T09:00:00Z" },
  { txnId: "txn_007", date: "2026-02-19", merchant: "Figma", canonicalMerchant: "Figma", amount: -150, currency: "USD", categoryId: "cat_02", categoryName: "SaaS Tools", source: "csv", createdAt: "2026-02-19T10:30:00Z" },
  { txnId: "txn_008", date: "2026-02-18", merchant: "Linear", canonicalMerchant: "Linear", amount: -120, currency: "USD", categoryId: "cat_02", categoryName: "SaaS Tools", source: "csv", createdAt: "2026-02-18T08:45:00Z" },
  { txnId: "txn_009", date: "2026-02-17", merchant: "Acme Corp Payment", canonicalMerchant: "Acme Corp", amount: 8500, currency: "USD", categoryId: "cat_08", categoryName: "Revenue", source: "csv", createdAt: "2026-02-17T16:00:00Z" },
  { txnId: "txn_010", date: "2026-02-16", merchant: "Vercel", canonicalMerchant: "Vercel", amount: -320, currency: "USD", categoryId: "cat_03", categoryName: "Cloud & Infra", source: "csv", createdAt: "2026-02-16T12:00:00Z" },
  { txnId: "txn_011", date: "2026-02-15", merchant: "Loom", canonicalMerchant: "Loom", amount: -99, currency: "USD", categoryId: "cat_02", categoryName: "SaaS Tools", source: "csv", createdAt: "2026-02-15T09:15:00Z" },
  { txnId: "txn_012", date: "2026-02-14", merchant: "Delta Airlines", canonicalMerchant: "Delta", amount: -780, currency: "USD", categoryId: "cat_07", categoryName: "Travel", source: "csv", createdAt: "2026-02-14T14:30:00Z" },
]

// =============================================
// Alerts
// =============================================
export const mockAlerts: AlertDTO[] = [
  {
    alertId: "alert_01",
    type: "spend_creep",
    severity: "warning",
    title: "SaaS spend up 8.3% month-over-month",
    description: "Your SaaS tools category has been increasing for 3 consecutive months. Major drivers: Notion (+20%), Linear (+15%).",
    evidenceIds: ["txn_003", "txn_008"],
  },
  {
    alertId: "alert_02",
    type: "overdue_invoice",
    severity: "critical",
    title: "2 invoices overdue > 30 days",
    description: "Invoices from Beta Inc and Gamma Ltd are 35+ days overdue with a combined $18,500 outstanding.",
    evidenceIds: ["inv_003", "inv_005"],
  },
  {
    alertId: "alert_03",
    type: "runway_crash",
    severity: "critical",
    title: "Pessimistic runway under 12 weeks",
    description: "Under pessimistic assumptions, cash runs out by week 11. Consider cost reduction or accelerating collections.",
    evidenceIds: ["txn_001", "txn_002", "inv_003"],
  },
  {
    alertId: "alert_04",
    type: "high_burn",
    severity: "warning",
    title: "Cloud costs spike detected",
    description: "AWS charges increased 40% vs last month. Check for unexpected usage or unoptimized resources.",
    evidenceIds: ["txn_002"],
  },
]

// =============================================
// Categorization Rules
// =============================================
export const mockRules: CategorizationRuleDTO[] = [
  { ruleId: "rule_01", pattern: "gusto", matchType: "contains", categoryId: "cat_01", enabled: true, createdAt: "2026-01-15T10:00:00Z" },
  { ruleId: "rule_02", pattern: "aws|amazon web", matchType: "regex", categoryId: "cat_03", enabled: true, createdAt: "2026-01-15T10:01:00Z" },
  { ruleId: "rule_03", pattern: "notion|figma|linear|loom|slack", matchType: "regex", categoryId: "cat_02", enabled: true, createdAt: "2026-01-15T10:02:00Z" },
  { ruleId: "rule_04", pattern: "google ads|facebook ads", matchType: "regex", categoryId: "cat_04", enabled: true, createdAt: "2026-01-15T10:03:00Z" },
]

// =============================================
// Commitments
// =============================================
export const mockCommitments: CommitmentDTO[] = [
  { commitmentId: "com_01", merchant: "Gusto Payroll", frequency: "monthly", typicalAmount: 28500, nextDueDate: "2026-03-27", confidence: 0.98, enabled: true },
  { commitmentId: "com_02", merchant: "AWS", frequency: "monthly", typicalAmount: 4200, nextDueDate: "2026-03-25", confidence: 0.85, enabled: true },
  { commitmentId: "com_03", merchant: "WeWork", frequency: "monthly", typicalAmount: 2400, nextDueDate: "2026-03-20", confidence: 0.99, enabled: true },
  { commitmentId: "com_04", merchant: "Notion", frequency: "monthly", typicalAmount: 480, nextDueDate: "2026-03-24", confidence: 0.95, enabled: true },
  { commitmentId: "com_05", merchant: "Google Ads", frequency: "monthly", typicalAmount: 3200, nextDueDate: "2026-03-22", confidence: 0.70, enabled: true },
]

// =============================================
// Invoices
// =============================================
export const mockInvoices: InvoiceDTO[] = [
  { invoiceId: "inv_001", customerId: "cust_01", customerName: "Acme Corp", amount: 15000, currency: "USD", issueDate: "2026-01-15", dueDate: "2026-02-14", paidDate: "2026-02-10", status: "paid", daysOverdue: 0, expectedPayDateBase: "2026-02-12", expectedPayDatePess: "2026-02-18", confidenceTier: "high", riskScore: 12, lastContactedAt: "2026-02-08" },
  { invoiceId: "inv_002", customerId: "cust_01", customerName: "Acme Corp", amount: 8500, currency: "USD", issueDate: "2026-02-01", dueDate: "2026-03-03", status: "open", daysOverdue: 0, expectedPayDateBase: "2026-03-01", expectedPayDatePess: "2026-03-08", confidenceTier: "high", riskScore: 18, lastContactedAt: "2026-02-20" },
  { invoiceId: "inv_003", customerId: "cust_02", customerName: "Beta Inc", amount: 12000, currency: "USD", issueDate: "2026-01-10", dueDate: "2026-01-25", status: "overdue", daysOverdue: 34, expectedPayDateBase: "2026-03-05", expectedPayDatePess: "2026-03-20", confidenceTier: "low", riskScore: 82, lastContactedAt: "2026-02-15" },
  { invoiceId: "inv_004", customerId: "cust_03", customerName: "Gamma Ltd", amount: 5200, currency: "USD", issueDate: "2026-02-05", dueDate: "2026-03-07", status: "open", daysOverdue: 0, expectedPayDateBase: "2026-03-10", expectedPayDatePess: "2026-03-18", confidenceTier: "medium", riskScore: 45, lastContactedAt: undefined },
  { invoiceId: "inv_005", customerId: "cust_03", customerName: "Gamma Ltd", amount: 6500, currency: "USD", issueDate: "2026-01-05", dueDate: "2026-01-20", status: "overdue", daysOverdue: 39, expectedPayDateBase: "2026-03-08", expectedPayDatePess: "2026-03-25", confidenceTier: "low", riskScore: 88, lastContactedAt: "2026-02-10" },
  { invoiceId: "inv_006", customerId: "cust_04", customerName: "Delta Systems", amount: 22000, currency: "USD", issueDate: "2026-02-10", dueDate: "2026-03-12", status: "open", daysOverdue: 0, expectedPayDateBase: "2026-03-12", expectedPayDatePess: "2026-03-18", confidenceTier: "high", riskScore: 15, lastContactedAt: "2026-02-25" },
  { invoiceId: "inv_007", customerId: "cust_05", customerName: "Epsilon Tech", amount: 3800, currency: "USD", issueDate: "2026-02-15", dueDate: "2026-03-17", status: "open", daysOverdue: 0, expectedPayDateBase: "2026-03-17", expectedPayDatePess: "2026-03-24", confidenceTier: "medium", riskScore: 35 },
]

// =============================================
// Customers
// =============================================
export const mockCustomers: CustomerDTO[] = [
  { customerId: "cust_01", name: "Acme Corp", onTimeRate: 0.85, medianDelayDays: 2, p90DelayDays: 8, exposureOpenAmount: 8500, exposureOverdueAmount: 0 },
  { customerId: "cust_02", name: "Beta Inc", onTimeRate: 0.40, medianDelayDays: 15, p90DelayDays: 35, exposureOpenAmount: 0, exposureOverdueAmount: 12000 },
  { customerId: "cust_03", name: "Gamma Ltd", onTimeRate: 0.55, medianDelayDays: 10, p90DelayDays: 28, exposureOpenAmount: 5200, exposureOverdueAmount: 6500 },
  { customerId: "cust_04", name: "Delta Systems", onTimeRate: 0.92, medianDelayDays: 0, p90DelayDays: 3, exposureOpenAmount: 22000, exposureOverdueAmount: 0 },
  { customerId: "cust_05", name: "Epsilon Tech", onTimeRate: 0.70, medianDelayDays: 5, p90DelayDays: 14, exposureOpenAmount: 3800, exposureOverdueAmount: 0 },
]

// =============================================
// Action Queue
// =============================================
export const mockActionQueue: ActionQueueItemDTO[] = [
  { actionId: "act_01", invoiceId: "inv_003", customerId: "cust_02", actionType: "escalation", dueAt: "2026-02-28", priorityScore: 95, reasons: ["34 days overdue", "Low on-time rate", "$12k exposure"], template: "Dear Beta Inc,\n\nThis is an urgent follow-up regarding invoice INV-003 for $12,000, which is now 34 days past due.\n\nPlease arrange payment immediately or contact us to discuss a payment plan.\n\nBest regards,\nFoundersHQ", evidenceIds: ["inv_003"] },
  { actionId: "act_02", invoiceId: "inv_005", customerId: "cust_03", actionType: "call", dueAt: "2026-02-28", priorityScore: 88, reasons: ["39 days overdue", "Second overdue invoice", "$6.5k at risk"], template: "Call script: Reference inv_005, $6,500 outstanding for 39 days. Gamma Ltd has another open invoice. Discuss combined payment plan.", evidenceIds: ["inv_005", "inv_004"] },
  { actionId: "act_03", invoiceId: "inv_004", customerId: "cust_03", actionType: "reminder", dueAt: "2026-03-05", priorityScore: 55, reasons: ["Due in 7 days", "Customer has overdue history"], template: "Hi Gamma Ltd,\n\nFriendly reminder that invoice INV-004 for $5,200 is due on March 7.\n\nPlease ensure payment is on track.\n\nBest,\nFoundersHQ", evidenceIds: ["inv_004"] },
  { actionId: "act_04", invoiceId: "inv_007", customerId: "cust_05", actionType: "reminder", dueAt: "2026-03-12", priorityScore: 35, reasons: ["Due in 17 days", "Medium risk score"], evidenceIds: ["inv_007"] },
]

// =============================================
// Invoice Metrics
// =============================================
export const mockInvoiceMetrics: InvoiceMetricsDTO = {
  outstanding: 58000,
  overdue: 18500,
  overdueRatio: 0.23,
  expectedCashInBase: 35700,
  expectedCashInPess: 22000,
  ageingBuckets: { "0-7": 25800, "8-30": 13700, "31-60": 18500, "60+": 0 },
}

// =============================================
// Runway Forecast
// =============================================
function generateRunwaySeries(): RunwayForecastDTO {
  const series = []
  let cashBase = 420000
  let cashPess = 420000
  for (let i = 0; i < 26; i++) {
    const week = new Date(2026, 1, 28 + i * 7)
    const weekStr = week.toISOString().split("T")[0]
    const outBase = 15000 + Math.random() * 5000
    const inBase = i % 3 === 0 ? 8000 + Math.random() * 4000 : 2000 + Math.random() * 2000
    const outPess = outBase * 1.2
    const inPess = inBase * 0.7
    cashBase = Math.max(0, cashBase - outBase + inBase)
    cashPess = Math.max(0, cashPess - outPess + inPess)
    series.push({
      weekStart: weekStr,
      cashBase: Math.round(cashBase),
      cashPess: Math.round(cashPess),
      flags: cashPess < 50000 ? ["low_cash_warning"] : [],
      evidenceIds: i % 4 === 0 ? ["txn_001", "inv_002"] : [],
    })
  }
  const crashPessIdx = series.findIndex((s) => s.cashPess <= 0)
  return {
    forecastId: "fc_001",
    generatedAt: "2026-02-28T10:00:00Z",
    horizonWeeks: 26,
    crashWeekBase: undefined,
    crashWeekPess: crashPessIdx >= 0 ? series[crashPessIdx].weekStart : undefined,
    cashWeeksBase: 18,
    cashWeeksPess: 11,
    series,
  }
}

export const mockRunwayForecast: RunwayForecastDTO = generateRunwaySeries()

export const mockWeeklyForecast: WeeklyForecastRowDTO[] = mockRunwayForecast.series.slice(0, 12).map((s, i) => ({
  weekStart: s.weekStart,
  startingCash: i === 0 ? 420000 : mockRunwayForecast.series[i - 1].cashBase,
  inflows: i % 3 === 0 ? 10000 : 3000,
  outflows: 17000,
  endingCash: s.cashBase,
  evidenceIds: s.evidenceIds,
  notes: s.flags.length > 0 ? "Low cash warning" : undefined,
}))

// =============================================
// Milestones
// =============================================
export const mockMilestones: MilestoneDTO[] = [
  { milestoneId: "ms_01", name: "Series A Close", targetType: "cash", targetValue: 2000000, targetWeekStart: "2026-06-01", statusBase: "on_track", statusPess: "off_track" },
  { milestoneId: "ms_02", name: "Break Even", targetType: "revenue", targetValue: 75000, targetWeekStart: "2026-09-01", statusBase: "on_track", statusPess: "off_track" },
  { milestoneId: "ms_03", name: "6-Month Cash Buffer", targetType: "runway", targetValue: 26, targetWeekStart: "2026-12-01", statusBase: "on_track", statusPess: "off_track" },
]

// =============================================
// Funding Routes
// =============================================
export const mockFundingRoutes: FundingRouteDTO[] = [
  {
    routeId: "fr_01", name: "SAFE Note (YC Style)", fitScore: 87,
    breakdown: { eligibility: 90, speed: 95, costRisk: 80, control: 85, riskCompatibility: 82 },
    whyBullets: ["Fast close timeline matches your 11-week pessimistic runway", "No board seat dilution preserves founder control", "Standard terms reduce legal costs"],
    warnings: ["Uncapped SAFEs may dilute more than expected at Series A", "No investor support structure included"],
    requirements: ["Current cap table", "Financial summary (last 6 months)", "Pitch deck"],
  },
  {
    routeId: "fr_02", name: "Revenue-Based Financing", fitScore: 72,
    breakdown: { eligibility: 65, speed: 85, costRisk: 70, control: 90, riskCompatibility: 55 },
    whyBullets: ["Non-dilutive preserves equity", "Quick deployment timeline", "Your monthly revenue supports qualification"],
    warnings: ["Requires consistent revenue history", "Repayment pressure during low months", "Higher effective cost than equity in some scenarios"],
    requirements: ["12 months bank statements", "Revenue projections", "Existing debt schedule"],
  },
  {
    routeId: "fr_03", name: "Seed Round (Priced)", fitScore: 68,
    breakdown: { eligibility: 75, speed: 50, costRisk: 65, control: 60, riskCompatibility: 78 },
    whyBullets: ["Sets clear valuation for future rounds", "Strategic investors can add value", "Larger raise possible ($500k-$2M)"],
    warnings: ["3-6 month close timeline may exceed pessimistic runway", "Board seat requirements", "Higher legal costs ($15-25k)"],
    requirements: ["Full data room", "Audited financials preferred", "Board consent"],
  },
]

// =============================================
// Funding Opportunities
// =============================================
export const mockFundingOpportunities: FundingOpportunityDTO[] = [
  { opportunityId: "opp_01", name: "Techstars Accelerator", provider: "Techstars", type: "accelerator", geography: "US", amountMin: 20000, amountMax: 120000, deadline: "2026-04-15", tags: ["Pre-seed", "SaaS", "Fintech"], lastUpdatedAt: "2026-02-20", parseConfidence: 0.95 },
  { opportunityId: "opp_02", name: "Indie.vc Revenue Fund", provider: "Indie.vc", type: "revenue_financing", geography: "US", amountMin: 100000, amountMax: 500000, tags: ["Revenue > $10k MRR", "B2B"], lastUpdatedAt: "2026-02-18", parseConfidence: 0.88 },
  { opportunityId: "opp_03", name: "AWS Activate Credits", provider: "Amazon", type: "grant_credits", geography: "Global", amountMin: 10000, amountMax: 100000, tags: ["Cloud credits", "Startups"], lastUpdatedAt: "2026-02-22", parseConfidence: 0.99 },
  { opportunityId: "opp_04", name: "Stripe Atlas SAFE", provider: "Stripe", type: "safe_note", geography: "US", amountMin: 20000, amountMax: 20000, deadline: "2026-06-01", tags: ["Atlas members", "Early stage"], lastUpdatedAt: "2026-02-15", parseConfidence: 0.82 },
]

// =============================================
// Funding Timeline
// =============================================
export const mockFundingTimeline: FundingTimelineItemDTO[] = [
  { stepId: "step_01", title: "Prepare financial summary & pitch deck", recommendedByDate: "2026-03-10", rationale: "Required for all funding routes. Start now to have materials ready.", relatedOpportunityIds: ["opp_01"] },
  { stepId: "step_02", title: "Apply for AWS Activate credits", recommendedByDate: "2026-03-15", rationale: "Quick, non-dilutive. Reduces cloud spend, extends runway by ~2 weeks.", relatedOpportunityIds: ["opp_03"] },
  { stepId: "step_03", title: "Submit Techstars application", recommendedByDate: "2026-04-01", rationale: "Deadline April 15. Accelerator provides funding + mentorship.", relatedOpportunityIds: ["opp_01"] },
  { stepId: "step_04", title: "Begin SAFE note outreach", recommendedByDate: "2026-04-15", rationale: "Target 4-6 week close. Aligns with runway timeline.", relatedOpportunityIds: ["opp_04"] },
  { stepId: "step_05", title: "Evaluate revenue-based financing", recommendedByDate: "2026-05-01", rationale: "If SAFE progress is slow, RBF provides a non-dilutive bridge.", relatedOpportunityIds: ["opp_02"] },
]

// =============================================
// Improvement Checklist
// =============================================
export const mockImprovementChecklist: ImprovementItemDTO[] = [
  { itemId: "imp_01", title: "Reduce SaaS tool overlap", description: "Consolidate Loom + Notion video features. Potential savings: $99/mo.", linkedModule: "spending", targetEvidenceIds: ["txn_011", "txn_003"], done: false },
  { itemId: "imp_02", title: "Collect overdue Beta Inc invoice", description: "Escalate inv_003 ($12,000). 34 days overdue. Would add 1.5 weeks to runway.", linkedModule: "invoices", targetEvidenceIds: ["inv_003"], done: false },
  { itemId: "imp_03", title: "Negotiate AWS reserved instances", description: "Current on-demand spend $4,200/mo. Reserved could save 30%.", linkedModule: "spending", targetEvidenceIds: ["txn_002"], done: false },
  { itemId: "imp_04", title: "Accelerate Gamma Ltd collections", description: "Two invoices totaling $11,700. Offer 5% early payment discount.", linkedModule: "invoices", targetEvidenceIds: ["inv_004", "inv_005"], done: false },
  { itemId: "imp_05", title: "Build 3-month cash buffer", description: "Current buffer ratio 2.1x. Target 3x for investor confidence.", linkedModule: "runway", done: true },
]
