"use client"

import { useBaseCurrency } from "@/lib/base-currency"
import { cn } from "@/lib/utils"

type MoneyProps = {
  value: number
  currency?: string
  unit?: "weeks" | "months" | "days"
  precision?: number
  signed?: boolean
  /**
   * Org base currency. When omitted, the component reads it from
   * `BaseCurrencyProvider`. Explicit prop wins when supplied — useful in
   * tests and Storybook.
   */
  baseCurrency?: string
  /**
   * Source-currency amount. When present AND `currency !== baseCurrency`,
   * the component renders the **base-currency** `value` as primary text
   * and reveals the source-currency `originalValue` on hover. When omitted
   * (or when the two currencies match), behaves exactly like the old
   * single-render path.
   */
  originalValue?: number
  className?: string
}

const FALLBACK_LOCALE = "en-US"

function formatCurrency(amount: number, currency: string, precision?: number): string {
  try {
    return new Intl.NumberFormat(FALLBACK_LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: precision ?? 2,
      maximumFractionDigits: precision ?? 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(precision ?? 2)}`
  }
}

/**
 * `<Money>` — deterministic currency formatter.
 *
 * - Tabular nums so columns align.
 * - En-dash (U+2013) for negatives, not hyphen-minus.
 * - Optional `signed` shows a `+` for positives.
 * - Optional `unit` switches to a unit display (e.g. "11.0 weeks").
 * - Phase 2.C: when `currency !== baseCurrency` and `originalValue` is
 *   provided, primary renders the base-currency `value` and the
 *   source-currency amount appears in a hover tooltip.
 *
 * Numbers always come from rows — never from an LLM.
 */
export function Money({
  value,
  currency = "USD",
  unit,
  precision,
  signed = false,
  baseCurrency: baseCurrencyProp,
  originalValue,
  className,
}: MoneyProps) {
  const contextBase = useBaseCurrency()
  const baseCurrency = baseCurrencyProp ?? contextBase.baseCurrency
  const isNegative = value < 0
  const abs = Math.abs(value)

  // Unit path is independent of FX.
  if (unit) {
    const p = precision ?? 1
    const formatted = `${abs.toFixed(p)} ${unit}`
    const sign = isNegative ? "–" : signed && value > 0 ? "+" : ""
    return (
      <span
        className={cn(
          "tabular-nums",
          isNegative && "text-[color:var(--danger,inherit)]",
          signed && !isNegative && value > 0 && "text-[color:var(--accent,inherit)]",
          className,
        )}
      >
        {sign}
        {formatted}
      </span>
    )
  }

  // Currency path. Detect "dual currency" mode: source differs from base
  // and the caller supplied an `originalValue` we can show on hover.
  const baseFormatted = formatCurrency(abs, baseCurrency, precision)
  const isDual =
    currency !== baseCurrency &&
    originalValue !== undefined &&
    Number.isFinite(originalValue)

  // The tooltip always describes the *other* currency. When dual-render is
  // active, hover shows the source-currency original. When it's inactive
  // but the caller passed a `baseCurrency` that differs from `currency`,
  // we fall back to the legacy "in <baseCurrency>" hint so existing call
  // sites keep working with no visible change.
  let title: string | undefined
  let primary: string
  if (isDual && originalValue !== undefined) {
    primary = baseFormatted
    const origAbs = Math.abs(originalValue)
    title = `${formatCurrency(origAbs, currency, precision)} ${currency}`
  } else {
    primary = formatCurrency(abs, currency, precision)
    title =
      baseCurrency && baseCurrency !== currency ? `in ${baseCurrency}` : undefined
  }

  const sign = isNegative ? "–" : signed && value > 0 ? "+" : ""

  return (
    <span
      className={cn(
        "tabular-nums",
        isNegative && "text-[color:var(--danger,inherit)]",
        signed && !isNegative && value > 0 && "text-[color:var(--accent,inherit)]",
        className,
      )}
      title={title}
    >
      {sign}
      {primary}
    </span>
  )
}
