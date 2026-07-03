"use client"

import * as React from "react"
import { Command } from "cmdk"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  FileText,
  LayoutDashboard,
  Loader2,
  Receipt,
  Search,
  Settings,
  Sparkles,
  TrendingDown,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useGlobalSearch } from "@/lib/api/queries/search"
import type { SearchResultDTO } from "@/lib/api/types"

type PageEntry = {
  label: string
  hint?: string
  path: string
  shortcut?: string
  icon: LucideIcon
}

/**
 * Static page entries shown at the top of the palette. Phase 1.F folds the
 * live `/search` results below this group.
 */
const PAGES: PageEntry[] = [
  {
    label: "Dashboard",
    hint: "Today's runway, burn, top movements",
    path: "/dashboard",
    shortcut: "g d",
    icon: LayoutDashboard,
  },
  {
    label: "Runway",
    hint: "Forecast and scenarios",
    path: "/runway",
    shortcut: "g r",
    icon: TrendingDown,
  },
  {
    label: "Invoices",
    hint: "Collections and AR",
    path: "/invoices",
    shortcut: "g i",
    icon: Receipt,
  },
  {
    label: "Spending",
    hint: "Categorised spend and vendors",
    path: "/spending",
    shortcut: "g s",
    icon: Wallet,
  },
  {
    label: "Funding",
    hint: "Round simulator and investor pipeline",
    path: "/funding",
    shortcut: "g f",
    icon: Banknote,
  },
  {
    label: "Settings",
    hint: "Org, members, integrations",
    path: "/settings",
    shortcut: "g ,",
    icon: Settings,
  },
]

/** Icon + display label per backend result type. */
const TYPE_META: Record<
  string,
  { icon: LucideIcon; label: string; group: string }
> = {
  transaction: { icon: Receipt, label: "Transaction", group: "Transactions" },
  invoice: { icon: FileText, label: "Invoice", group: "Invoices" },
  customer: { icon: User, label: "Customer", group: "Customers" },
  commitment: { icon: CalendarClock, label: "Commitment", group: "Commitments" },
  funding_opportunity: {
    icon: Building2,
    label: "Funding opportunity",
    group: "Funding",
  },
  insight: { icon: Sparkles, label: "Insight", group: "Insights" },
  page: { icon: LayoutDashboard, label: "Page", group: "Pages" },
}

const TYPE_ORDER: readonly string[] = [
  "transaction",
  "invoice",
  "customer",
  "commitment",
  "funding_opportunity",
  "insight",
  "page",
]

/**
 * Build the destination URL for a search result. Backend returns a
 * `deep_link` plus an optional `open_param`; for the routes that already
 * implement the `?openTxnId=` / `?openInvoiceId=` auto-open convention we
 * append the matching query param. Other routes navigate to the page only.
 */
function resultHref(result: SearchResultDTO): string {
  const base = result.deep_link
  const openParam = result.open_param
  if (!openParam) return base
  if (result.type === "transaction" && base.startsWith("/spending/transactions")) {
    return `${base}?openTxnId=${encodeURIComponent(openParam)}`
  }
  if (result.type === "invoice" && base.startsWith("/invoices/list")) {
    return `${base}?openInvoiceId=${encodeURIComponent(openParam)}`
  }
  return base
}

/** Group results by backend `type`, preserving server-side score order. */
function groupResults(
  results: ReadonlyArray<SearchResultDTO>,
): Array<{ type: string; items: SearchResultDTO[] }> {
  const buckets = new Map<string, SearchResultDTO[]>()
  for (const r of results) {
    const bucket = buckets.get(r.type) ?? []
    bucket.push(r)
    buckets.set(r.type, bucket)
  }
  const out: Array<{ type: string; items: SearchResultDTO[] }> = []
  for (const t of TYPE_ORDER) {
    const items = buckets.get(t)
    if (items && items.length > 0) {
      out.push({ type: t, items })
      buckets.delete(t)
    }
  }
  // Any unknown types land at the end, sorted by name for determinism.
  for (const t of Array.from(buckets.keys()).sort()) {
    const items = buckets.get(t)
    if (items) out.push({ type: t, items })
  }
  return out
}

/** Locally filter the static page list against the typed query. */
function filterStaticPages(query: string): PageEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return PAGES
  return PAGES.filter((p) => {
    const haystack = `${p.label} ${p.hint ?? ""}`.toLowerCase()
    return haystack.includes(q)
  })
}

const GROUP_HEADING_CLASSES =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[color:var(--ink-3)]"

const ITEM_CLASSES =
  "group flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-[color:var(--ink)] data-[selected=true]:bg-[color:var(--surface-2)] data-[selected=true]:text-[color:var(--ink)]"

const ICON_BADGE_CLASSES =
  "grid h-7 w-7 place-items-center rounded-md border border-[color:var(--line)] bg-[color:var(--bg)] text-[color:var(--ink-2)] group-data-[selected=true]:border-[color:var(--accent)]/40 group-data-[selected=true]:text-[color:var(--accent)]"

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")

  // Reset query whenever the palette is closed so the next open is fresh.
  React.useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const go = React.useCallback(
    (path: string) => {
      onOpenChange(false)
      router.push(path)
    },
    [onOpenChange, router],
  )

  // Debounced live search; the hook only fires when the palette is open.
  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = useGlobalSearch(query, open)

  const trimmedQuery = query.trim()
  const groupedResults = React.useMemo(
    () => groupResults(searchResults ?? []),
    [searchResults],
  )
  const visiblePages = React.useMemo(() => filterStaticPages(query), [query])

  const hasLiveResults = groupedResults.some((g) => g.items.length > 0)
  // The "Searching…" state appears while the user has typed enough for a
  // request and SWR is still resolving the first response.
  const isSearching = searchLoading && trimmedQuery.length >= 2

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 grid place-items-start bg-black/55 backdrop-blur-[2px] pt-[10vh] px-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          shouldFilter={false}
          loop
          label="Command Palette"
          className="flex flex-col"
        >
          <div className="flex items-center gap-2 border-b border-[color:var(--line)] px-3 py-2.5">
            <Search
              aria-hidden
              className="h-4 w-4 text-[color:var(--ink-3)]"
            />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search transactions, invoices, customers…"
              className="flex-1 bg-transparent text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] outline-none"
            />
            {isSearching ? (
              <Loader2
                aria-hidden
                className="h-3.5 w-3.5 animate-spin text-[color:var(--ink-3)]"
              />
            ) : null}
            <kbd className="rounded border border-[color:var(--line)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--ink-3)]">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-[color:var(--ink-3)]">
              {searchError ? (
                <span className="text-[color:var(--accent)]">
                  Search is unavailable right now. Try again in a moment.
                </span>
              ) : isSearching ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                  Searching…
                </span>
              ) : trimmedQuery.length === 0 ? (
                "Start typing to search transactions, invoices, customers, and pages."
              ) : trimmedQuery.length === 1 ? (
                "Keep typing — at least 2 characters."
              ) : (
                "No matches."
              )}
            </Command.Empty>

            {visiblePages.length > 0 ? (
              <Command.Group heading="Pages" className={GROUP_HEADING_CLASSES}>
                {visiblePages.map((p) => {
                  const Icon = p.icon
                  return (
                    <Command.Item
                      key={p.path}
                      value={`page:${p.path}`}
                      onSelect={() => go(p.path)}
                      className={ITEM_CLASSES}
                    >
                      <span className={ICON_BADGE_CLASSES}>
                        <Icon aria-hidden className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex flex-1 flex-col leading-tight">
                        <span className="font-medium">{p.label}</span>
                        {p.hint ? (
                          <span className="text-xs text-[color:var(--ink-3)]">
                            {p.hint}
                          </span>
                        ) : null}
                      </span>
                      {p.shortcut ? (
                        <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-[color:var(--ink-3)]">
                          {p.shortcut.split(" ").map((part, i) => (
                            <kbd
                              key={`${p.path}-shortcut-${i}`}
                              className="rounded border border-[color:var(--line)] px-1 py-0.5"
                            >
                              {part}
                            </kbd>
                          ))}
                        </span>
                      ) : null}
                      <ArrowRight
                        aria-hidden
                        className="h-3.5 w-3.5 text-[color:var(--ink-3)] opacity-0 transition-opacity group-data-[selected=true]:opacity-100"
                      />
                    </Command.Item>
                  )
                })}
              </Command.Group>
            ) : null}

            {hasLiveResults ? (
              <>
                {groupedResults.map((group) => {
                  const meta = TYPE_META[group.type] ?? {
                    icon: Search,
                    label: group.type,
                    group: group.type,
                  }
                  const Icon = meta.icon
                  return (
                    <Command.Group
                      key={group.type}
                      heading={meta.group}
                      className={GROUP_HEADING_CLASSES}
                    >
                      {group.items.map((r) => {
                        const href = resultHref(r)
                        return (
                          <Command.Item
                            key={`${r.type}:${r.id}`}
                            value={`${r.type}:${r.id}`}
                            onSelect={() => go(href)}
                            className={ITEM_CLASSES}
                          >
                            <span className={ICON_BADGE_CLASSES}>
                              <Icon aria-hidden className="h-3.5 w-3.5" />
                            </span>
                            <span className="flex flex-1 flex-col leading-tight">
                              <span className="font-medium truncate">
                                {r.title}
                              </span>
                              {r.subtitle ? (
                                <span className="truncate text-xs text-[color:var(--ink-3)]">
                                  {r.subtitle}
                                </span>
                              ) : null}
                            </span>
                            <ArrowRight
                              aria-hidden
                              className="h-3.5 w-3.5 text-[color:var(--ink-3)] opacity-0 transition-opacity group-data-[selected=true]:opacity-100"
                            />
                          </Command.Item>
                        )
                      })}
                    </Command.Group>
                  )
                })}
              </>
            ) : null}
          </Command.List>

          <div className="flex items-center justify-between border-t border-[color:var(--line)] bg-[color:var(--bg)]/40 px-3 py-2 text-[11px] text-[color:var(--ink-3)]">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-[color:var(--line)] px-1 font-mono">
                ↑
              </kbd>
              <kbd className="rounded border border-[color:var(--line)] px-1 font-mono">
                ↓
              </kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-[color:var(--line)] px-1 font-mono">
                ⏎
              </kbd>
              open
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}
