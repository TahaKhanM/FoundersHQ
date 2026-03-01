"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ActionQueueCard } from "./action-queue-card"
import { ActionQueueDetailPanel } from "./action-queue-detail-panel"
import type { ActionQueueItemUI, ActionQueueFilters, LogTouchPayload, SeverityLevel } from "./types"

interface ActionQueueBoardProps {
  items: ActionQueueItemUI[]
  selectedId?: string
  onSelect?: (itemId: string) => void
  filters: ActionQueueFilters
  onFilterChange?: (filters: ActionQueueFilters) => void
  onOpenInvoice?: (invoiceId: string) => void
  onCopyTemplate?: (itemId: string) => void
  onLogTouch?: (itemId: string, payload: LogTouchPayload) => void
  onEvidenceClick?: (evidenceId: string) => void
  highAmountThreshold?: number
  isLoading?: boolean
  className?: string
}

const severityOrder: SeverityLevel[] = ["critical", "high", "medium", "low"]

const severityLabels: Record<SeverityLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
}

export function ActionQueueBoard({
  items,
  selectedId,
  onSelect,
  filters,
  onFilterChange,
  onOpenInvoice,
  onCopyTemplate,
  onLogTouch,
  onEvidenceClick,
  highAmountThreshold = 10000,
  isLoading = false,
  className,
}: ActionQueueBoardProps) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = React.useState(-1)

  // Group items by severity
  const groupedItems = React.useMemo(() => {
    const groups: Record<SeverityLevel, ActionQueueItemUI[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    }

    items.forEach((item) => {
      groups[item.severity].push(item)
    })

    return groups
  }, [items])

  // Flatten for keyboard navigation
  const flatItems = React.useMemo(() => {
    return severityOrder.flatMap((severity) => groupedItems[severity])
  }, [groupedItems])

  const selectedItem = React.useMemo(() => {
    return items.find((item) => item.id === selectedId) || null
  }, [items, selectedId])

  // Keyboard navigation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!flatItems.length) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setFocusedIndex((prev) => {
            const next = prev < flatItems.length - 1 ? prev + 1 : 0
            return next
          })
          break
        case "ArrowUp":
          e.preventDefault()
          setFocusedIndex((prev) => {
            const next = prev > 0 ? prev - 1 : flatItems.length - 1
            return next
          })
          break
        case "Enter":
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < flatItems.length) {
            onSelect?.(flatItems[focusedIndex].id)
          }
          break
        case "Escape":
          e.preventDefault()
          onSelect?.("")
          setFocusedIndex(-1)
          break
      }
    },
    [flatItems, focusedIndex, onSelect]
  )

  // Focus management
  React.useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const cards = listRef.current.querySelectorAll('[role="listitem"]')
      const card = cards[focusedIndex] as HTMLElement
      card?.focus()
    }
  }, [focusedIndex])

  const handleFilterToggle = (key: keyof ActionQueueFilters) => {
    onFilterChange?.({
      ...filters,
      [key]: !filters[key],
    })
  }

  return (
    <div
      className={cn("flex h-full", className)}
      onKeyDown={handleKeyDown}
    >
      {/* Left Panel - List */}
      <div className="flex-1 flex flex-col min-w-0 border-r">
        {/* Filters */}
        <div className="p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="overdue-only"
                checked={filters.overdueOnly}
                onCheckedChange={() => handleFilterToggle("overdueOnly")}
                aria-label="Show overdue items only"
              />
              <Label htmlFor="overdue-only" className="text-sm cursor-pointer">
                Overdue only
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="no-touch-7"
                checked={filters.noTouchIn7Days}
                onCheckedChange={() => handleFilterToggle("noTouchIn7Days")}
                aria-label="Show items with no touch in 7 days"
              />
              <Label htmlFor="no-touch-7" className="text-sm cursor-pointer">
                No touch in 7 days
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="high-amount"
                checked={filters.highAmount}
                onCheckedChange={() => handleFilterToggle("highAmount")}
                aria-label={`Show high amount items (over $${highAmountThreshold.toLocaleString()})`}
              />
              <Label htmlFor="high-amount" className="text-sm cursor-pointer">
                High amount ({'>'}${(highAmountThreshold / 1000).toFixed(0)}k)
              </Label>
            </div>
          </div>
        </div>

        {/* Items List */}
        <ScrollArea className="flex-1">
          <div
            ref={listRef}
            role="list"
            aria-label="Action queue items grouped by severity"
            className="p-4 space-y-6"
          >
            {severityOrder.map((severity) => {
              const groupItems = groupedItems[severity]
              if (groupItems.length === 0) return null

              return (
                <div key={severity} role="group" aria-label={`${severityLabels[severity]} priority items`}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      {severityLabels[severity]}
                    </h3>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {groupItems.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {groupItems.map((item) => (
                      <ActionQueueCard
                        key={item.id}
                        item={item}
                        isSelected={item.id === selectedId}
                        onSelect={onSelect}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {items.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No action items match your filters</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Detail */}
      <div className="w-[400px] shrink-0 bg-card hidden lg:block">
        <ActionQueueDetailPanel
          item={selectedItem}
          onOpenInvoice={onOpenInvoice}
          onCopyTemplate={onCopyTemplate}
          onLogTouch={onLogTouch}
          onEvidenceClick={onEvidenceClick}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

// Export sub-components for flexibility
export { ActionQueueCard } from "./action-queue-card"
export { ActionQueueDetailPanel } from "./action-queue-detail-panel"
export type { ActionQueueItemUI, ActionQueueFilters, LogTouchPayload } from "./types"
