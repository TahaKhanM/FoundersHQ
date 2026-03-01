// Action Queue UI Types - Pure UI types, no business logic

export interface ActionQueueItemUI {
  id: string
  invoiceId: string
  customerName: string
  invoiceNumber?: string
  amount: number
  currency: string
  dueDateISO?: string
  daysOverdue?: number
  actionType: "reminder" | "call" | "escalation"
  priorityScore: number // 0–100
  severity: "critical" | "high" | "medium" | "low"
  reasons: string[]
  template?: string
  lastTouchedAtISO?: string
  lastTouchType?: string
  isCompleted: boolean
  deepLink?: string
  evidenceIds?: string[]
}

export interface ActionQueueFilters {
  overdueOnly: boolean
  noTouchIn7Days: boolean
  highAmount: boolean
}

export interface LogTouchPayload {
  channel: "email" | "phone" | "sms" | "other"
  touchType: "reminder" | "follow_up" | "negotiation" | "escalation" | "payment_received"
  notes: string
}

export type SeverityLevel = "critical" | "high" | "medium" | "low"
