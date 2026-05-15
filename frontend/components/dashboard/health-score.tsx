"use client"

import { cn } from "@/lib/utils"

export interface HealthFacet {
  label: string
  /** 0–100. */
  value: number
  /** Short hint shown under the bar. */
  hint?: string
}

interface HealthScoreProps {
  facets: HealthFacet[]
  className?: string
}

/**
 * Health score breakdown bars.
 *
 * Colour bands are token-driven per Phase 1.D.1:
 * - `var(--accent)` for `value >= 80`
 * - `var(--warn)` for `60–79`
 * - `var(--danger)` for `< 60`
 */
export function HealthScore({ facets, className }: HealthScoreProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {facets.map((f) => (
        <HealthRow key={f.label} {...f} />
      ))}
    </div>
  )
}

function HealthRow({ label, value, hint }: HealthFacet) {
  const safe = Math.max(0, Math.min(100, value))
  const color =
    safe >= 80
      ? "var(--accent)"
      : safe >= 60
        ? "var(--warn)"
        : "var(--danger)"

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium text-foreground">{safe}</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-2)]"
        role="progressbar"
        aria-label={label}
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${safe}%`, background: color }}
        />
      </div>
      {hint ? (
        <p className="text-[11px] text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  )
}
