"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react"

type HealthBand = "great" | "good" | "warning" | "critical"

interface HealthBreakdownItem {
  key: string
  label: string
  value: number
  weightPct: number
}

interface HealthScoreCardProps {
  score: number
  band: HealthBand
  breakdown: HealthBreakdownItem[]
  notes?: string[]
  className?: string
}

const bandConfig: Record<HealthBand, {
  label: string
  color: string
  bg: string
  icon: React.ElementType
  progressClass: string
}> = {
  great: {
    label: "Great",
    color: "text-success",
    bg: "bg-success/10",
    icon: CheckCircle2,
    progressClass: "[&>[data-slot=progress-indicator]]:bg-success",
  },
  good: {
    label: "Good",
    color: "text-chart-1",
    bg: "bg-chart-1/10",
    icon: TrendingUp,
    progressClass: "[&>[data-slot=progress-indicator]]:bg-chart-1",
  },
  warning: {
    label: "Warning",
    color: "text-warning-foreground",
    bg: "bg-warning/10",
    icon: AlertCircle,
    progressClass: "[&>[data-slot=progress-indicator]]:bg-warning",
  },
  critical: {
    label: "Critical",
    color: "text-destructive",
    bg: "bg-destructive/10",
    icon: AlertTriangle,
    progressClass: "[&>[data-slot=progress-indicator]]:bg-destructive",
  },
}

export function HealthScoreCard({
  score,
  band,
  breakdown,
  notes,
  className,
}: HealthScoreCardProps) {
  const config = bandConfig[band]
  const BandIcon = config.icon

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Financial Health</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Health score information"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[280px]">
                <p className="text-xs">
                  Financial health is calculated based on runway, burn rate, revenue growth, and other key metrics.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Score Display */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex items-center justify-center w-20 h-20 rounded-full",
              config.bg
            )}
            role="img"
            aria-label={`Health score: ${score} out of 100, status: ${config.label}`}
          >
            <span className={cn("text-3xl font-bold", config.color)}>
              {score}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <BandIcon className={cn("h-5 w-5", config.color)} />
              <span className={cn("text-lg font-semibold", config.color)}>
                {config.label}
              </span>
            </div>
            <Progress
              value={score}
              className={cn("h-2", config.progressClass)}
              aria-label={`Health score progress: ${score}%`}
            />
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Score Breakdown</h4>
          <div className="space-y-2">
            {breakdown.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm text-muted-foreground truncate">
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground/70">
                    ({item.weightPct}%)
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Progress
                    value={item.value}
                    className="w-16 h-1.5"
                    aria-label={`${item.label}: ${item.value} out of 100`}
                  />
                  <span className="text-sm font-mono font-medium w-8 text-right">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {notes && notes.length > 0 && (
          <div className="pt-2 border-t">
            <h4 className="text-sm font-medium text-foreground mb-2">Notes</h4>
            <ul className="space-y-1">
              {notes.map((note, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
