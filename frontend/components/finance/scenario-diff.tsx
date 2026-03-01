"use client"

import { cn } from "@/lib/utils"

export type ScenarioSummary = {
  id: string
  label: string
  endingCash: number
  runwayWeeks: number
}

type ScenarioDiffProps = {
  a: ScenarioSummary
  b: ScenarioSummary
  className?: string
}

/**
 * `<ScenarioDiff>` — minimal two-up scenario placeholder.
 *
 * Phase 3.A replaces this with the full scenario comparison (charts,
 * inflow/outflow breakdown, evidence drill-downs). For now it surfaces
 * the runway-weeks summary so other code can reference the type without
 * blocking on phase 3.
 */
export function ScenarioDiff({ a, b, className }: ScenarioDiffProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {[a, b].map((s) => (
        <div
          key={s.id}
          className="rounded-md border border-[color:var(--line,currentColor)] p-3"
        >
          <div className="text-xs uppercase tracking-wide text-[color:var(--ink-3,inherit)]">
            {s.label}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {s.runwayWeeks.toFixed(1)}w
          </div>
        </div>
      ))}
    </div>
  )
}
