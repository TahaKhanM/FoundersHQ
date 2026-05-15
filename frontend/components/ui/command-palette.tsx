"use client"

import * as React from "react"
import { Command } from "cmdk"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Banknote,
  LayoutDashboard,
  Receipt,
  Search,
  Settings,
  TrendingDown,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type PageEntry = {
  label: string
  hint?: string
  path: string
  shortcut?: string
  icon: LucideIcon
}

/**
 * Phase-0 palette: navigation only. Phase 1.F adds search across
 * transactions, invoices, customers, vendors, and insights.
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
          shouldFilter
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
              placeholder="Jump to a page…"
              className="flex-1 bg-transparent text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] outline-none"
            />
            <kbd className="rounded border border-[color:var(--line)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--ink-3)]">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-[color:var(--ink-3)]">
              No matches. Phase 1.F adds search across transactions,
              invoices, and customers.
            </Command.Empty>

            <Command.Group
              heading="Pages"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[color:var(--ink-3)]"
            >
              {PAGES.map((p) => {
                const Icon = p.icon
                return (
                  <Command.Item
                    key={p.path}
                    value={`${p.label} ${p.hint ?? ""}`}
                    onSelect={() => go(p.path)}
                    className="group flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-[color:var(--ink)] data-[selected=true]:bg-[color:var(--surface-2)] data-[selected=true]:text-[color:var(--ink)]"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-md border border-[color:var(--line)] bg-[color:var(--bg)] text-[color:var(--ink-2)] group-data-[selected=true]:border-[color:var(--accent)]/40 group-data-[selected=true]:text-[color:var(--accent)]">
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
