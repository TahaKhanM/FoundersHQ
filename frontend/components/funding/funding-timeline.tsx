"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/format"
import { parseISO, differenceInDays, addDays, format, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

type TimelineItemType = "prep" | "non_dilutive" | "equity" | "debt_rbf" | "fallback"

interface TimelineItemUI {
  id: string
  title: string
  type: TimelineItemType
  startISO: string
  endISO?: string
  subtitle?: string
  deepLink?: string
}

interface FundingTimelineProps {
  startISO: string
  endISO: string
  items: TimelineItemUI[]
  onSelectItem?: (id: string) => void
  className?: string
}

const typeConfig: Record<TimelineItemType, {
  label: string
  color: string
  bg: string
  border: string
}> = {
  prep: {
    label: "Preparation",
    color: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-muted-foreground/30",
  },
  non_dilutive: {
    label: "Non-Dilutive",
    color: "text-success",
    bg: "bg-success/20",
    border: "border-success/50",
  },
  equity: {
    label: "Equity",
    color: "text-chart-1",
    bg: "bg-chart-1/20",
    border: "border-chart-1/50",
  },
  debt_rbf: {
    label: "Debt/RBF",
    color: "text-chart-2",
    bg: "bg-chart-2/20",
    border: "border-chart-2/50",
  },
  fallback: {
    label: "Fallback",
    color: "text-warning-foreground",
    bg: "bg-warning/20",
    border: "border-warning/50",
  },
}

export function FundingTimeline({
  startISO,
  endISO,
  items,
  onSelectItem,
  className,
}: FundingTimelineProps) {
  const startDate = parseISO(startISO)
  const endDate = parseISO(endISO)
  const totalDays = differenceInDays(endDate, startDate)

  // Generate month markers
  const months = eachMonthOfInterval({ start: startDate, end: endDate })

  // Sort items by start date and alternate above/below
  const sortedItems = [...items].sort(
    (a, b) => parseISO(a.startISO).getTime() - parseISO(b.startISO).getTime()
  )

  // Assign items to rows (above or below the line)
  const itemsWithPosition = sortedItems.map((item, index) => ({
    ...item,
    position: index % 2 === 0 ? "above" : "below",
  }))

  const getPositionPercent = (dateISO: string) => {
    const date = parseISO(dateISO)
    const days = differenceInDays(date, startDate)
    return Math.max(0, Math.min(100, (days / totalDays) * 100))
  }

  const getWidthPercent = (startItemISO: string, endItemISO?: string) => {
    const itemEnd = endItemISO ? parseISO(endItemISO) : parseISO(startItemISO)
    const start = parseISO(startItemISO)
    const days = Math.max(1, differenceInDays(itemEnd, start))
    return Math.max(2, (days / totalDays) * 100)
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Funding Timeline</CardTitle>
          <span className="text-xs text-muted-foreground">
            {formatDate(startISO, "MMM yyyy")} - {formatDate(endISO, "MMM yyyy")}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4" role="list" aria-label="Timeline legend">
          {Object.entries(typeConfig).map(([type, config]) => (
            <div key={type} className="flex items-center gap-1.5" role="listitem">
              <div
                className={cn("w-3 h-3 rounded-sm", config.bg, "border", config.border)}
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground">{config.label}</span>
            </div>
          ))}
        </div>

        <ScrollArea className="w-full">
          <div
            className="relative min-w-[600px] h-[180px] px-4"
            role="img"
            aria-label="Funding timeline visualization"
          >
            {/* Month ticks */}
            <div className="absolute inset-x-4 top-[90px] h-[1px] bg-border">
              {months.map((month, index) => {
                const pos = getPositionPercent(month.toISOString())
                return (
                  <div
                    key={index}
                    className="absolute top-0 -translate-x-1/2"
                    style={{ left: `${pos}%` }}
                  >
                    <div className="h-2 w-[1px] bg-border" />
                    <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(month, "MMM")}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Timeline items */}
            <TooltipProvider>
              {itemsWithPosition.map((item) => {
                const config = typeConfig[item.type]
                const left = getPositionPercent(item.startISO)
                const width = getWidthPercent(item.startISO, item.endISO)
                const isAbove = item.position === "above"

                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onSelectItem?.(item.id)}
                        className={cn(
                          "absolute flex flex-col items-start",
                          "transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isAbove ? "bottom-[95px]" : "top-[95px]"
                        )}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 8)}%`,
                          minWidth: "60px",
                        }}
                        aria-label={`${item.title}: ${config.label}, starts ${formatDate(item.startISO)}${item.endISO ? ` ends ${formatDate(item.endISO)}` : ""}`}
                      >
                        {/* Connector line */}
                        <div
                          className={cn(
                            "absolute left-3 w-[1px] bg-border",
                            isAbove ? "bottom-0 h-3" : "top-0 h-3"
                          )}
                        />

                        {/* Item bar */}
                        <div
                          className={cn(
                            "w-full rounded-md border px-2 py-1",
                            config.bg,
                            config.border,
                            isAbove ? "mb-3" : "mt-3"
                          )}
                        >
                          <p className={cn("text-xs font-medium truncate", config.color)}>
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {item.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Dot on timeline */}
                        <div
                          className={cn(
                            "absolute left-3 w-2 h-2 rounded-full border-2 bg-background -translate-x-1/2",
                            config.border
                          )}
                          style={{
                            [isAbove ? "bottom" : "top"]: "-4px",
                          }}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side={isAbove ? "top" : "bottom"}>
                      <div className="space-y-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {config.label}
                        </p>
                        <p className="text-xs">
                          {formatDate(item.startISO)}
                          {item.endISO && ` - ${formatDate(item.endISO)}`}
                        </p>
                        {item.subtitle && (
                          <p className="text-xs text-muted-foreground">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </TooltipProvider>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
