"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { formatCurrency, formatRelative } from "@/lib/utils/format"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertTriangle,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react"
import type { ActionQueueItemUI, SeverityLevel } from "./types"

interface ActionQueueCardProps {
  item: ActionQueueItemUI
  isSelected?: boolean
  onSelect?: (itemId: string) => void
  className?: string
}

const severityConfig: Record<SeverityLevel, { 
  border: string
  bg: string
  text: string
  icon: React.ElementType
  label: string
}> = {
  critical: {
    border: "border-l-4 border-l-destructive",
    bg: "bg-destructive/5",
    text: "text-destructive",
    icon: AlertTriangle,
    label: "Critical",
  },
  high: {
    border: "border-l-4 border-l-warning",
    bg: "bg-warning/5",
    text: "text-warning-foreground",
    icon: AlertCircle,
    label: "High",
  },
  medium: {
    border: "border-l-4 border-l-chart-1",
    bg: "bg-chart-1/5",
    text: "text-chart-1",
    icon: Clock,
    label: "Medium",
  },
  low: {
    border: "border-l-4 border-l-muted-foreground",
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    icon: Clock,
    label: "Low",
  },
}

const actionTypeIcons: Record<string, React.ElementType> = {
  reminder: Mail,
  call: Phone,
  escalation: AlertTriangle,
}

export function ActionQueueCard({
  item,
  isSelected = false,
  onSelect,
  className,
}: ActionQueueCardProps) {
  const config = severityConfig[item.severity]
  const SeverityIcon = config.icon
  const ActionIcon = actionTypeIcons[item.actionType] || Mail

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onSelect?.(item.id)
    }
  }

  return (
    <Card
      role="listitem"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={() => onSelect?.(item.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-pointer transition-all py-0 gap-0",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "hover:shadow-md",
        config.border,
        isSelected && "ring-2 ring-primary shadow-md",
        item.isCompleted && "opacity-60",
        className
      )}
    >
      <CardContent className="p-4">
        {/* Priority Score Badge - Prominent Display */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-lg font-bold text-xl",
                      config.bg,
                      config.text
                    )}
                    aria-label={`Priority ${item.priorityScore} out of 100 (${config.label})`}
                  >
                    {item.priorityScore}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Priority Score: {item.priorityScore}/100</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-foreground truncate">
                  {item.customerName}
                </span>
                {item.isCompleted && (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                )}
              </div>
              {item.invoiceNumber && (
                <p className="text-sm text-muted-foreground truncate">
                  Invoice #{item.invoiceNumber}
                </p>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="font-semibold text-foreground">
              {formatCurrency(item.amount)}
            </p>
            {item.daysOverdue && item.daysOverdue > 0 && (
              <p className="text-xs text-destructive">
                {item.daysOverdue} days overdue
              </p>
            )}
          </div>
        </div>

        {/* Priority Progress Bar */}
        <div className="mb-3">
          <Progress
            value={item.priorityScore}
            aria-label={`Priority ${item.priorityScore} out of 100 (${config.label})`}
            className={cn(
              "h-2",
              item.severity === "critical" && "[&>[data-slot=progress-indicator]]:bg-destructive",
              item.severity === "high" && "[&>[data-slot=progress-indicator]]:bg-warning",
              item.severity === "medium" && "[&>[data-slot=progress-indicator]]:bg-chart-1",
              item.severity === "low" && "[&>[data-slot=progress-indicator]]:bg-muted-foreground"
            )}
          />
        </div>

        {/* Severity & Action Type */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn("gap-1", config.text)}
            >
              <SeverityIcon className="h-3 w-3" />
              {config.label}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <ActionIcon className="h-3 w-3" />
              <span className="capitalize">{item.actionType}</span>
            </Badge>
          </div>
        </div>

        {/* Reasons */}
        {item.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.reasons.slice(0, 3).map((reason, idx) => (
              <Badge key={idx} variant="outline" className="text-xs font-normal">
                {reason}
              </Badge>
            ))}
            {item.reasons.length > 3 && (
              <Badge variant="outline" className="text-xs font-normal">
                +{item.reasons.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Last Touch Info */}
        {item.lastTouchedAtISO && (
          <div className="text-xs text-muted-foreground">
            Last touch: {item.lastTouchType || "Contact"} {formatRelative(item.lastTouchedAtISO)}
          </div>
        )}

        {/* Completed State */}
        {item.isCompleted && item.lastTouchedAtISO && (
          <div className="mt-2 p-2 bg-success/10 rounded-md text-xs text-success flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed {formatRelative(item.lastTouchedAtISO)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
