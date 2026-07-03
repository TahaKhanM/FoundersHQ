"use client"

import { useState } from "react"
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react"

import { EvidenceChip } from "@/components/finance/evidence-chip"
import { Button } from "@/components/ui/button"
import { dismissInsight, INSIGHT_TYPE_LABELS } from "@/lib/api/queries/insights"
import type { InsightDTO } from "@/lib/api/types"
import { cn } from "@/lib/utils"

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical")
    return <AlertCircle className="h-4 w-4 text-[color:var(--danger,currentColor)]" aria-label="critical" />
  if (severity === "warn")
    return <AlertTriangle className="h-4 w-4 text-[color:var(--warn,currentColor)]" aria-label="warning" />
  return <Info className="h-4 w-4 text-[color:var(--info,currentColor)]" aria-label="info" />
}

function formatRelative(iso: string | null): string {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function InsightRow({
  insight,
  onDismiss,
}: {
  insight: InsightDTO
  onDismiss?: (i: InsightDTO) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dismissed = insight.status === "dismissed"

  async function handleDismiss() {
    if (pending || dismissed) return
    setPending(true)
    setError(null)
    try {
      const next = await dismissInsight(insight.id)
      onDismiss?.(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to dismiss")
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0",
        dismissed && "opacity-60",
      )}
      data-testid={`insight-row-${insight.id}`}
    >
      <div className="pt-0.5">
        <SeverityIcon severity={insight.severity} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {insight.title}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {INSIGHT_TYPE_LABELS[insight.type] ?? insight.type}
          </span>
        </div>
        {insight.body && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {insight.body}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatRelative(insight.createdAt)}</span>
          {insight.evidenceIds.length > 0 && (
            <EvidenceChip ids={insight.evidenceIds} />
          )}
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      {!dismissed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          disabled={pending}
          aria-label="Dismiss insight"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
