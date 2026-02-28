"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface EvidenceLinkProps {
  evidenceId: string
  onClick?: (id: string) => void
  className?: string
}

export function EvidenceLink({ evidenceId, onClick, className }: EvidenceLinkProps) {
  const type = evidenceId.startsWith("txn_") ? "txn" : evidenceId.startsWith("inv_") ? "inv" : "ref"

  return (
    <Badge
      variant="outline"
      className={cn(
        "cursor-pointer text-xs font-mono transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary/30",
        type === "txn" && "border-chart-1/30 text-chart-1",
        type === "inv" && "border-chart-2/30 text-chart-2",
        className
      )}
      onClick={() => onClick?.(evidenceId)}
    >
      {evidenceId}
    </Badge>
  )
}

export function EvidenceChips({
  ids,
  onClickId,
}: {
  ids: string[]
  onClickId?: (id: string) => void
}) {
  if (!ids.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <EvidenceLink key={id} evidenceId={id} onClick={onClickId} />
      ))}
    </div>
  )
}

/** Parse text and replace txn_*/inv_* tokens with clickable chips */
export function renderTextWithEvidence(
  text: string,
  onClickId?: (id: string) => void
) {
  const parts = text.split(/((?:txn|inv)_\w+)/g)
  return parts.map((part, i) => {
    if (/^(txn|inv)_\w+$/.test(part)) {
      return <EvidenceLink key={i} evidenceId={part} onClick={onClickId} />
    }
    return <span key={i}>{part}</span>
  })
}
