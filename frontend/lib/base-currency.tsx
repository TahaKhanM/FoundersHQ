"use client"

/**
 * Base-currency context.
 *
 * Reads the org's `base_currency` from `/org` once on mount and exposes it to
 * every descendant via `useBaseCurrency()`. The provider is wired into the
 * top-level `<Providers>` shell so any client component on any (shell) page
 * can call the hook without prop-drilling.
 *
 * SSR / unauth note: while the org request is pending — or in mock mode
 * before the seed loads — `useBaseCurrency()` returns the safe default
 * `"USD"`. Components should not branch on "undefined" base currency; the
 * `<Money>` component degrades gracefully when source == base.
 */
import { createContext, useContext, type ReactNode } from "react"

import { useOrg } from "@/lib/api/queries/org"

interface BaseCurrencyContextValue {
  baseCurrency: string
  fiscalYearStartMonth: number
  isLoading: boolean
}

const DEFAULT_VALUE: BaseCurrencyContextValue = {
  baseCurrency: "USD",
  fiscalYearStartMonth: 1,
  isLoading: false,
}

const BaseCurrencyContext = createContext<BaseCurrencyContextValue>(DEFAULT_VALUE)

export function BaseCurrencyProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useOrg()
  const value: BaseCurrencyContextValue = {
    baseCurrency: data?.baseCurrency ?? "USD",
    fiscalYearStartMonth: data?.fiscalYearStartMonth ?? 1,
    isLoading,
  }
  return (
    <BaseCurrencyContext.Provider value={value}>
      {children}
    </BaseCurrencyContext.Provider>
  )
}

/**
 * Read the org's base currency. Safe to call anywhere a `<BaseCurrencyProvider>`
 * is in the tree; falls back to `"USD"` when no provider is mounted (e.g. in
 * isolated unit-test renders).
 */
export function useBaseCurrency(): BaseCurrencyContextValue {
  return useContext(BaseCurrencyContext)
}
