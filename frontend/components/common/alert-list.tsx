"use client"

import { AlertTriangle, AlertCircle, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EvidenceChips } from "./evidence-link"
import { cn } from "@/lib/utils"
import type { AlertDTO } from "@/lib/api/types"

interface AlertListProps {
  alerts: AlertDTO[]
  onClickEvidenceId?: (id: string) => void
}

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
  warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10" },
}

export function AlertList({ alerts, onClickEvidenceId }: AlertListProps) {
  if (!alerts.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No alerts at this time.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const config = severityConfig[alert.severity]
        const Icon = config.icon
        return (
          <div
            key={alert.alertId}
            className={cn("flex gap-3 rounded-lg border border-border p-3", config.bg)}
          >
            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground leading-snug">
                  {alert.title}
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] shrink-0",
                    alert.severity === "critical" && "border-destructive/30 text-destructive",
                    alert.severity === "warning" && "border-warning/30 text-warning-foreground"
                  )}
                >
                  {alert.severity}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {alert.description}
              </p>
              {alert.evidenceIds.length > 0 && (
                <EvidenceChips ids={alert.evidenceIds} onClickId={onClickEvidenceId} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
