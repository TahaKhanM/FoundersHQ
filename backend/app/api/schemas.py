"""Pydantic DTOs for FoundersHQ API (match frontend types)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


# ---- Pagination ----
class PaginationParams(BaseModel):
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(20, ge=1, le=100)
    sort: str | None = None


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    page: int
    page_size: int
    total: int
class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserDTO(BaseModel):
    id: str
    email: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class SessionDTO(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserDTO


class RegisterResponse(BaseModel):
    user: UserDTO
    access_token: str
    token_type: str = "bearer"


# ---- Org ----
class OrgDTO(BaseModel):
    id: str
    name: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class OrgDataDeleteRequest(BaseModel):
    confirm: bool = False


# ---- Ingest ----
class IngestJobResponse(BaseModel):
    job_id: str


class IngestJobStatusDTO(BaseModel):
    job_id: str
    status: str
    errors: list[str] = []
    imported_transactions: int | None = None
    imported_invoices: int | None = None
    skipped: int | None = None


class QuestionnairePayload(BaseModel):
    cash_balance: Decimal | None = None
    currency: str | None = None
    monthly_costs_estimate: Decimal | None = None
    monthly_revenue_estimate: Decimal | None = None
    notes: str | None = None


class QuestionnaireSummary(BaseModel):
    saved: bool = True
    message: str = "Questionnaire data saved"


# ---- Spending ----
class SpendingMetricsDTO(BaseModel):
    total_outflow_30d: Decimal
    total_outflow_90d: Decimal
    total_inflow_30d: Decimal
    total_inflow_90d: Decimal
    net_burn_30d: Decimal
    net_burn_90d: Decimal
    run_rate_outflow: Decimal
    run_rate_net_burn: Decimal
    spend_creep_pct: float | None = None
    spend_creep_alert: bool = False
    cash_weeks: float | None = None
    cash_weeks_flag: str | None = None  # "infinite" | "na" | null
    buffer_ratio: float | None = None
    revenue_breakeven_gap: Decimal | None = None
    currency: str = "USD"
    multi_currency_warning: bool = False


class TransactionDTO(BaseModel):
    id: str
    org_id: str
    txn_date: date
    description: str | None
    merchant_raw: str | None
    merchant_canonical: str | None
    amount: Decimal
    currency: str
    source: str
    category_id: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TransactionCategoryPatch(BaseModel):
    category_id: str | None = None


class CategoryDTO(BaseModel):
    id: str
    org_id: str
    name: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CategorizationRuleDTO(BaseModel):
    id: str
    org_id: str
    pattern: str
    match_type: str
    category_id: str
    enabled: bool
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CategorizationRuleCreate(BaseModel):
    pattern: str
    match_type: str = "contains"
    category_id: str


class CategorizationRulePatch(BaseModel):
    pattern: str | None = None
    match_type: str | None = None
    category_id: str | None = None
    enabled: bool | None = None


class CommitmentDTO(BaseModel):
    id: str
    org_id: str
    merchant_canonical: str
    frequency: str
    typical_amount: Decimal
    currency: str
    last_seen_date: date
    next_due_date: date | None
    confidence: float
    enabled: bool
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CommitmentPatch(BaseModel):
    enabled: bool | None = None


class AlertDTO(BaseModel):
    id: str
    type: str
    title: str
    message: str
    severity: str  # info | warning | critical
    evidence_ids: list[str] = []
    created_at: datetime | None = None


# ---- Invoices ----
class InvoiceOverviewDTO(BaseModel):
    total_open: Decimal
    total_overdue: Decimal
    count_open: int
    count_overdue: int
    ageing_buckets: dict[str, Decimal]  # e.g. 0-30, 31-60, 61-90, 90+
    expected_cash_in_series: list[dict[str, Any]]  # [{week_start, amount_base, amount_pess}]
    currency: str = "USD"


class InvoiceDTO(BaseModel):
    id: str
    org_id: str
    customer_id: str
    invoice_number: str
    issue_date: date
    due_date: date
    paid_date: date | None
    amount: Decimal
    currency: str
    status: str
    po_number: str | None
    notes: str | None
    needs_review: bool = False
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceDetailDTO(InvoiceDTO):
    customer_name: str | None = None
    predictions: InvoicePredictionDTO | None = None
    risk: InvoiceRiskDTO | None = None
    events: list[TouchLogDTO] = []
    evidence_ids: list[str] = []


class InvoicePredictionDTO(BaseModel):
    expected_pay_date_base: date
    expected_pay_date_pess: date
    confidence_tier: str
    computed_at: datetime | None = None


class InvoiceRiskDTO(BaseModel):
    risk_score: float
    priority_score: float
    reasons: list[str]
    computed_at: datetime | None = None


class CustomerDTO(BaseModel):
    id: str
    org_id: str
    name_raw: str
    name_canonical: str | None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CustomerDetailDTO(CustomerDTO):
    invoices: list[InvoiceDTO] = []


class ActionQueueItemDTO(BaseModel):
    invoice_id: str
    customer_name: str
    amount: Decimal
    due_date: date
    days_overdue: int
    priority_score: float
    suggested_action: str
    evidence_ids: list[str] = []


class TouchLogDTO(BaseModel):
    id: str
    invoice_id: str
    channel: str
    touch_type: str
    notes: str | None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TouchLogCreate(BaseModel):
    invoice_id: str
    channel: str  # email/call/other
    touch_type: str  # reminder/escalation/dispute
    notes: str | None = None


class InvoiceTemplatesRequest(BaseModel):
    invoice_ids: list[str]


class InvoiceTemplateItem(BaseModel):
    invoice_id: str
    template_key: str
    subject: str | None = None
    body: str | None = None


# ---- Runway ----
class RunwayForecastRequest(BaseModel):
    horizon_weeks: int = Field(26, ge=1, le=104)
    scenario_params: dict[str, Any] | None = None
    milestones: list[dict[str, Any]] | None = None


class WeeklyForecastRowDTO(BaseModel):
    week_start: date
    starting_cash: Decimal
    inflows: Decimal
    outflows: Decimal
    ending_cash: Decimal
    flags: list[str] | None = None
    evidence_ids: list[str] | None = None


class RunwayForecastDTO(BaseModel):
    id: str
    org_id: str
    generated_at: datetime
    horizon_weeks: int
    cash_start: Decimal
    currency: str
    crash_week_base: int | None
    crash_week_pess: int | None
    cash_weeks_base: float | None
    cash_weeks_pess: float | None
    scenario_params: dict | None = None

    model_config = ConfigDict(from_attributes=True)


class RunwayForecastFullResponse(BaseModel):
    forecast: RunwayForecastDTO
    rows: list[WeeklyForecastRowDTO]
    attribution: list[dict[str, Any]] = []  # significant dips/rises with evidence_ids


class ScenarioCreate(BaseModel):
    name: str
    params: dict[str, Any] | None = None


class ScenarioApplyRequest(BaseModel):
    scenario_id: str
    persist: bool = False


class MilestoneDTO(BaseModel):
    id: str
    org_id: str
    name: str
    target_type: str
    target_value: Decimal
    target_week_start: date | None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class MilestoneCreate(BaseModel):
    name: str
    target_type: str  # cash/runway/revenue
    target_value: Decimal
    target_week_start: date | None = None


class MilestonePatch(BaseModel):
    name: str | None = None
    target_type: str | None = None
    target_value: Decimal | None = None
    target_week_start: date | None = None


class AttributionItemDTO(BaseModel):
    week_start: date
    delta_type: str  # dip | rise
    delta_amount: Decimal
    evidence_ids: list[str]
    components: list[dict[str, Any]]


# ---- Funding ----
class FundingRouteDTO(BaseModel):
    route_type: str
    name: str
    fit_score: float
    breakdown: dict[str, float]  # Eligibility, Speed, etc.
    fired_rules: list[str]
    opportunities_count: int = 0


class FundingOpportunityDTO(BaseModel):
    id: str
    provider_id: str | None
    type: str
    name: str
    geography: str | None
    sector_tags: list[str] | None
    stage_tags: list[str] | None
    amount_min: Decimal | None
    amount_max: Decimal | None
    deadline: date | None
    cycle_time_days_est: int | None
    eligibility_text: str | None
    requirements_text: str | None
    application_url: str | None
    source_url: str | None
    last_seen_at: datetime | None
    last_updated_at: datetime | None
    parse_confidence: float | None
    saved_status: str | None = None  # planned/applied/declined if user saved

    model_config = ConfigDict(from_attributes=True)


class FundingOpportunitySaveRequest(BaseModel):
    opportunity_id: str
    status: str = "planned"  # planned/applied/declined
    notes: str | None = None


class FundingTimelineItemDTO(BaseModel):
    opportunity_id: str
    name: str
    type: str
    recommended_by_date: date | None
    deadline: date | None
    rationale: str
    urgency: str


class ImprovementItemDTO(BaseModel):
    id: str
    linked_module: str  # spending/invoices/runway/funding
    title: str
    description: str
    target_evidence_ids: list[str]
    priority: float


# ---- LLM ----
class LLMExplainRequest(BaseModel):
    question: str
    context_modules: list[str] = []  # spending, invoices, runway, funding
    focus_evidence_ids: list[str] | None = None


class LLMExplainResponse(BaseModel):
    answer: str
    citations: list[str]
    confidence: float
    disclaimers: list[str] = []


class LLMDraftMessageRequest(BaseModel):
    invoice_id: str
    tone: str = "professional"  # professional/friendly/urgent


class LLMDraftMessageResponse(BaseModel):
    message: str
    citations: list[str] = []


# ---- Integration: Funding ingest ----
class FundingOpportunityIngestItem(BaseModel):
    name: str
    type: str
    geography: str | None = None
    amount_min: Decimal | None = None
    amount_max: Decimal | None = None
    deadline: date | None = None
    cycle_time_days_est: int | None = None
    eligibility_text: str | None = None
    requirements_text: str | None = None
    application_url: str | None = None
    source_url: str | None = None
    last_seen_at: datetime | None = None
    last_updated_at: datetime | None = None
    parse_confidence: float | None = None
    provider_name: str | None = None
    sector_tags: list[str] | None = None
    stage_tags: list[str] | None = None


class FundingOpportunitiesIngestRequest(BaseModel):
    opportunities: list[FundingOpportunityIngestItem]


class FundingIngestStats(BaseModel):
    created: int
    updated: int
    errors: int
    total: int


# ---- Integration: Invoice parsing ----
class ParsedInvoiceField(BaseModel):
    value: Any
    confidence: float


class ParsedInvoicePayload(BaseModel):
    invoice_number: ParsedInvoiceField | None = None
    customer_name: ParsedInvoiceField | None = None
    issue_date: ParsedInvoiceField | None = None
    due_date: ParsedInvoiceField | None = None
    amount: ParsedInvoiceField | None = None
    currency: ParsedInvoiceField | None = None
    po_number: ParsedInvoiceField | None = None
    tax: ParsedInvoiceField | None = None
    line_items: list[dict] | None = None


class InvoiceParsingConfirmRequest(BaseModel):
    invoice_number: str
    customer_name: str
    customer_id: str | None = None  # existing or omit to create new
    issue_date: date
    due_date: date
    amount: Decimal
    currency: str
    po_number: str | None = None
    notes: str | None = None
