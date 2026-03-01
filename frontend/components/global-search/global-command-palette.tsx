"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Kbd } from "@/components/ui/kbd"
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import {
  FileText,
  CreditCard,
  Users,
  FileStack,
  Landmark,
  Layout,
  Clock,
  Search,
  AlertTriangle,
  AlertCircle,
  Zap,
} from "lucide-react"
import type { SearchResultUI, SearchChip, QuickActionUI } from "./types"

interface GlobalCommandPaletteProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  activeChip: SearchChip
  onChipChange: (chip: SearchChip) => void
  results: SearchResultUI[]
  recent?: SearchResultUI[]
  quickActions?: QuickActionUI[]
  onSelectResult: (result: SearchResultUI | QuickActionUI) => void
  isLoading?: boolean
  className?: string
}

const chipConfig: { value: SearchChip; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "All", icon: Search },
  { value: "invoices", label: "Invoices", icon: FileText },
  { value: "transactions", label: "Transactions", icon: CreditCard },
  { value: "customers", label: "Customers", icon: Users },
  { value: "funding", label: "Funding", icon: Landmark },
  { value: "pages", label: "Pages", icon: Layout },
]

const typeIcons: Record<string, React.ElementType> = {
  invoice: FileText,
  transaction: CreditCard,
  customer: Users,
  commitment: FileStack,
  funding: Landmark,
  page: Layout,
}

const severityStyles = {
  critical: "text-destructive",
  high: "text-warning-foreground",
  medium: "text-chart-1",
  low: "text-muted-foreground",
}

export function GlobalCommandPalette({
  isOpen,
  onOpenChange,
  query,
  onQueryChange,
  activeChip,
  onChipChange,
  results,
  recent = [],
  quickActions = [],
  onSelectResult,
  isLoading = false,
  className,
}: GlobalCommandPaletteProps) {
  // Keyboard shortcut to open
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault()
        onOpenChange(!isOpen)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [isOpen, onOpenChange])

  // Group results by type
  const groupedResults = React.useMemo(() => {
    const groups: Record<string, SearchResultUI[]> = {}
    results.forEach((result) => {
      if (!groups[result.type]) {
        groups[result.type] = []
      }
      groups[result.type].push(result)
    })
    return groups
  }, [results])

  const typeLabels: Record<string, string> = {
    invoice: "Invoices",
    transaction: "Transactions",
    customer: "Customers",
    commitment: "Commitments",
    funding: "Funding",
    page: "Pages",
  }

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search for invoices, transactions, customers, and more"
      className={cn("sm:max-w-[600px]", className)}
    >
      <Command
        shouldFilter={false}
        className="rounded-lg"
      >
        <CommandInput
          placeholder="Search invoices, vendors, or pages..."
          value={query}
          onValueChange={onQueryChange}
        />

        {/* Chip Filters */}
        <div className="flex items-center gap-1 px-3 py-2 border-b overflow-x-auto">
          {chipConfig.map((chip) => {
            const Icon = chip.icon
            return (
              <button
                key={chip.value}
                onClick={() => onChipChange(chip.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                  "hover:bg-accent",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeChip === chip.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
                aria-pressed={activeChip === chip.value}
              >
                <Icon className="h-3 w-3" />
                {chip.label}
              </button>
            )
          })}
        </div>

        <CommandList className="max-h-[400px]">
          <CommandEmpty className="py-8">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Search className="h-8 w-8 opacity-40" />
              <p>No results found.</p>
              <p className="text-xs">Try searching invoices, vendors, or pages.</p>
            </div>
          </CommandEmpty>

          {/* Quick Actions - Show when query is empty */}
          {!query && quickActions.length > 0 && (
            <CommandGroup heading="Quick Actions">
              {quickActions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={action.id}
                  onSelect={() => onSelectResult(action)}
                  className="gap-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {action.icon || <Zap className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{action.title}</p>
                    {action.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">
                        {action.subtitle}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Recent Searches - Show when query is empty */}
          {!query && recent.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Recent">
                {recent.map((item) => {
                  const TypeIcon = typeIcons[item.type] || FileText
                  return (
                    <CommandItem
                      key={`recent-${item.id}`}
                      value={`recent-${item.id}`}
                      onSelect={() => onSelectResult(item)}
                      className="gap-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{item.title}</p>
                          {item.severity && (
                            <SeverityIndicator severity={item.severity} />
                          )}
                        </div>
                        {item.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                      <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </>
          )}

          {/* Search Results - Grouped by type */}
          {query && Object.keys(groupedResults).length > 0 && (
            <>
              {Object.entries(groupedResults).map(([type, items]) => {
                const TypeIcon = typeIcons[type] || FileText
                return (
                  <CommandGroup key={type} heading={typeLabels[type] || type}>
                    {items.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => onSelectResult(item)}
                        className="gap-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          {item.icon || <TypeIcon className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{item.title}</p>
                            {item.severity && (
                              <SeverityIndicator severity={item.severity} />
                            )}
                          </div>
                          {item.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.subtitle}
                            </p>
                          )}
                          {item.snippet && (
                            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                              {item.snippet}
                            </p>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })}
            </>
          )}
        </CommandList>

        {/* Footer with keyboard hints */}
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd>
              <span>to select</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd>
              <span>to close</span>
            </span>
          </div>
          {isLoading && (
            <span className="text-muted-foreground">Searching...</span>
          )}
        </div>
      </Command>
    </CommandDialog>
  )
}

function SeverityIndicator({ severity }: { severity: string }) {
  const Icon = severity === "critical" ? AlertTriangle : AlertCircle
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        severityStyles[severity as keyof typeof severityStyles]
      )}
    >
      <Icon className="h-3 w-3" />
    </span>
  )
}

// Trigger button component for convenience
export function CommandPaletteTrigger({
  className,
  onClick,
}: {
  className?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground",
        "hover:bg-muted hover:text-foreground transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search...</span>
      <Kbd className="ml-2 hidden sm:inline-flex">
        <span className="text-xs">⌘</span>K
      </Kbd>
    </button>
  )
}
