// Global Search / Command Palette UI Types
import type { ReactNode } from "react"

export type SearchResultType =
  | "invoice"
  | "transaction"
  | "customer"
  | "commitment"
  | "funding"
  | "page"

export type SearchChip =
  | "all"
  | "invoices"
  | "transactions"
  | "funding"
  | "pages"
  | "customers"
  | "commitments"

export interface SearchResultUI {
  type: SearchResultType
  id: string
  title: string
  subtitle?: string
  snippet?: string
  icon?: ReactNode
  severity?: "critical" | "high" | "medium" | "low"
  deepLink: string
  openParam?: { key: string; value: string }
}

export interface QuickActionUI {
  id: string
  title: string
  subtitle?: string
  deepLink: string
  icon?: ReactNode
}
