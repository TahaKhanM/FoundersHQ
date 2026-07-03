"use client"

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

type DeltaBadgeProps = {
  value: number
  format?: "percent" | "currency" | "absolute"
  className?: string
}

/**
 * `<DeltaBadge>` — `+3.2%`, `–$1,234`, or a flat dash depending on sign.
 *
 * Direction picks the icon and the colour token. The value is rendered
 * with tabular nums and an en-dash prefix for negatives via the icon
 * affordance — we don't pre-pend a sign character so the badge stays
 * compact.
 */
export function DeltaBadge({
  value,
  format = "percent",
  className,
}: DeltaBadgeProps) {
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat"
  const abs = Math.abs(value)
  let body: string
  if (format === "percent") {
    body = `${abs.toFixed(1)}%`
  } else if (format === "currency") {
    body = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(abs)
  } else {
    body = abs.toLocaleString()
  }

  const Icon =
    dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus
  const color =
    dir === "up"
      ? "text-[color:var(--accent,inherit)]"
      : dir === "down"
        ? "text-[color:var(--danger,inherit)]"
        : "text-[color:var(--ink-3,inherit)]"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs tabular-nums",
        color,
        className,
      )}
    >
      <Icon size={12} aria-hidden />
      {body}
    </span>
  )
}
