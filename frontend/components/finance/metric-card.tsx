"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { DeltaBadge } from "./delta-badge"
import { EvidenceChip, type EvidenceKind } from "./evidence-chip"
import { Sparkline } from "./sparkline"

type MetricCardProps = {
  label: string
  value: ReactNode
  delta?: number
  spark?: number[]
  evidenceIds?: string[]
  evidenceKind?: EvidenceKind
  onOpenEvidence?: (id: string, kind: EvidenceKind) => void
  density?: "compact" | "expanded"
  className?: string
}

/**
 * `<MetricCard>` — the canonical headline-number card.
 *
 * Composes `<Money>` (passed in via `value`), `<DeltaBadge>`,
 * `<Sparkline>`, and `<EvidenceChip>`. Use `density="expanded"` on
 * full-page hero cards; default `compact` for grid tiles.
 */
export function MetricCard({
  label,
  value,
  delta,
  spark,
  evidenceIds,
  evidenceKind,
  onOpenEvidence,
  density = "compact",
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-[color:var(--line,currentColor)] bg-[color:var(--surface,transparent)]",
        density === "compact" ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wide text-[color:var(--ink-3,inherit)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-semibold leading-tight tracking-tight",
          density === "compact" ? "text-2xl" : "text-3xl",
        )}
      >
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {delta !== undefined && <DeltaBadge value={delta} format="percent" />}
        {spark && spark.length > 1 && <Sparkline data={spark} />}
        {evidenceIds && evidenceIds.length > 0 && (
          <EvidenceChip
            ids={evidenceIds}
            kind={evidenceKind}
            onOpen={onOpenEvidence}
          />
        )}
      </div>
    </div>
  )
}
