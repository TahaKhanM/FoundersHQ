"use client"

import { cn } from "@/lib/utils"

type MoneyProps = {
  value: number
  currency?: string
  unit?: "weeks" | "months" | "days"
  precision?: number
  signed?: boolean
  baseCurrency?: string
  className?: string
}

/**
 * `<Money>` — deterministic currency formatter.
 *
 * - Tabular nums so columns align.
 * - En-dash (U+2013) for negatives, not hyphen-minus.
 * - Optional `signed` shows a `+` for positives.
 * - Optional `unit` switches to a unit display (e.g. "11.0 weeks").
 * - Optional `baseCurrency` reveals "in <base>" on hover when it differs.
 *
 * Numbers always come from rows — never from an LLM.
 */
export function Money({
  value,
  currency = "USD",
  unit,
  precision,
  signed = false,
  baseCurrency,
  className,
}: MoneyProps) {
  const isNegative = value < 0
  const abs = Math.abs(value)
  let formatted: string

  if (unit) {
    const p = precision ?? 1
    formatted = `${abs.toFixed(p)} ${unit}`
  } else {
    try {
      formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: precision ?? 2,
        maximumFractionDigits: precision ?? 2,
      }).format(abs)
    } catch {
      formatted = `${currency} ${abs.toFixed(precision ?? 2)}`
    }
  }

  // en-dash for negatives (U+2013), not hyphen-minus
  const sign = isNegative ? "–" : signed && value > 0 ? "+" : ""

  return (
    <span
      className={cn(
        "tabular-nums",
        isNegative && "text-[color:var(--danger,inherit)]",
        signed && !isNegative && value > 0 && "text-[color:var(--accent,inherit)]",
        className,
      )}
      title={baseCurrency && baseCurrency !== currency ? `in ${baseCurrency}` : undefined}
    >
      {sign}
      {formatted}
    </span>
  )
}
