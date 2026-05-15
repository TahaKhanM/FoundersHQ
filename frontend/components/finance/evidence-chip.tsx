"use client"

import { Receipt } from "lucide-react"

import { cn } from "@/lib/utils"

export type EvidenceKind =
  | "transaction"
  | "invoice"
  | "commitment"
  | "vendor_finding"
  | "insight"

type EvidenceChipProps = {
  ids: string[]
  kind?: EvidenceKind
  onOpen?: (id: string, kind: EvidenceKind) => void
  className?: string
}

/**
 * `<EvidenceChip>` — pill that links to a list of evidence UUIDs.
 *
 * Every LLM-derived claim in FoundersHQ ships with `evidence_ids`. This
 * chip is how the UI surfaces those IDs: hover-able, focusable, and on
 * click it raises the first id to the caller, which is expected to open a
 * `RecordSheet` for the underlying row.
 *
 * If the array is empty the chip renders nothing — silent absence is the
 * cue to the reader that no receipts back this claim.
 */
export function EvidenceChip({
  ids,
  kind = "transaction",
  onOpen,
  className,
}: EvidenceChipProps) {
  if (!ids.length) return null
  const label = ids.length === 1 ? "1 source" : `${ids.length} sources`
  return (
    <button
      type="button"
      onClick={() => {
        const first = ids[0]
        if (first) onOpen?.(first, kind)
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[color:var(--line,currentColor)] bg-[color:var(--surface-2,transparent)]",
        "px-2 py-0.5 text-xs text-[color:var(--ink-2,inherit)] hover:bg-[color:var(--surface-2,transparent)]",
        "tabular-nums",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,currentColor)]",
        className,
      )}
      aria-label={`Evidence: ${ids.length} item${ids.length > 1 ? "s" : ""}`}
    >
      <Receipt size={12} className="opacity-70" />
      {label}
    </button>
  )
}
