"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"

/* -------------------------------------------------------------------------- */
/* Tokens                                                                     */
/* -------------------------------------------------------------------------- */

type TokenSwatch = {
  name: string
  cssVar: string
  blurb: string
}

const SURFACES: TokenSwatch[] = [
  { name: "bg", cssVar: "--bg", blurb: "Page background" },
  { name: "surface", cssVar: "--surface", blurb: "Cards, panels" },
  { name: "surface-2", cssVar: "--surface-2", blurb: "Nested surfaces" },
  { name: "line", cssVar: "--line", blurb: "Borders, dividers" },
]

const INK: TokenSwatch[] = [
  { name: "ink", cssVar: "--ink", blurb: "Primary text" },
  { name: "ink-2", cssVar: "--ink-2", blurb: "Secondary text" },
  { name: "ink-3", cssVar: "--ink-3", blurb: "Tertiary, captions" },
]

const SIGNAL: TokenSwatch[] = [
  { name: "accent", cssVar: "--accent", blurb: "Positive cash, primary CTA" },
  { name: "warn", cssVar: "--warn", blurb: "Amber — collections, runway" },
  { name: "danger", cssVar: "--danger", blurb: "Burn, overdue, negative cash" },
  { name: "info", cssVar: "--info", blurb: "Used sparingly" },
]

function Swatch({ token }: { token: TokenSwatch }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] p-3">
      <div
        aria-hidden
        className="h-10 w-10 shrink-0 rounded-md border border-[color:var(--line)]"
        style={{ backgroundColor: `var(${token.cssVar})` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-[color:var(--ink)]">
            {token.name}
          </span>
          <span className="font-mono text-[10px] text-[color:var(--ink-3)]">
            {token.cssVar}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[color:var(--ink-3)]">
          {token.blurb}
        </p>
      </div>
    </div>
  )
}

function TokenGrid({
  title,
  tokens,
}: {
  title: string
  tokens: TokenSwatch[]
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-3)]">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {tokens.map((t) => (
          <Swatch key={t.cssVar} token={t} />
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* DataTable demo                                                             */
/* -------------------------------------------------------------------------- */

type Transaction = {
  id: string
  merchant: string
  amount: number
  category: string
  date: string
  status: "cleared" | "pending"
}

const SAMPLE_ROWS: Transaction[] = [
  {
    id: "txn_001",
    merchant: "AWS",
    amount: -4200,
    category: "Cloud",
    date: "2026-05-12",
    status: "cleared",
  },
  {
    id: "txn_002",
    merchant: "Gusto",
    amount: -28500,
    category: "Payroll",
    date: "2026-05-10",
    status: "cleared",
  },
  {
    id: "txn_003",
    merchant: "Notion",
    amount: -84,
    category: "SaaS",
    date: "2026-05-09",
    status: "cleared",
  },
  {
    id: "txn_004",
    merchant: "Stripe payout",
    amount: 18420,
    category: "Revenue",
    date: "2026-05-08",
    status: "cleared",
  },
  {
    id: "txn_005",
    merchant: "Figma",
    amount: -360,
    category: "SaaS",
    date: "2026-05-07",
    status: "pending",
  },
]

function formatMoney(value: number): string {
  // Local-only formatter for the playground demo. Production code routes
  // money through <Money /> (owned by 0.C); we don't want to depend on it
  // here and break the playground if 0.C hasn't landed.
  const sign = value < 0 ? "–" : "" // en-dash
  const abs = Math.abs(value)
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const COLUMNS: ColumnDef<Transaction>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: (info) => (
      <span className="font-mono text-xs text-[color:var(--ink-2)]">
        {String(info.getValue())}
      </span>
    ),
  },
  {
    accessorKey: "merchant",
    header: "Merchant",
    cell: (info) => (
      <span className="font-medium">{String(info.getValue())}</span>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: (info) => (
      <span className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--bg)] px-2 py-0.5 text-[11px] text-[color:var(--ink-2)]">
        {String(info.getValue())}
      </span>
    ),
  },
  {
    accessorKey: "amount",
    header: () => <span className="block text-right">Amount</span>,
    cell: (info) => {
      const v = info.getValue() as number
      return (
        <span
          className={`block text-right tabular-nums ${
            v < 0
              ? "text-[color:var(--danger)]"
              : "text-[color:var(--accent)]"
          }`}
        >
          {formatMoney(v)}
        </span>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: (info) => {
      const v = info.getValue() as Transaction["status"]
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--ink-2)]">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                v === "cleared"
                  ? "var(--accent)"
                  : "var(--warn)",
            }}
          />
          {v}
        </span>
      )
    },
  },
]

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function DesignSystemPage() {
  const [lastOpened, setLastOpened] = React.useState<Transaction | null>(null)

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-8">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--ink-3)]">
          Phase 0.D · Dev only
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--ink)]">
          Design system
        </h1>
        <p className="max-w-2xl text-sm text-[color:var(--ink-2)]">
          The token set from{" "}
          <code className="font-mono text-xs text-[color:var(--ink)]">
            docs/DESIGN_SYSTEM.md
          </code>
          , and the primitives that live under{" "}
          <code className="font-mono text-xs text-[color:var(--ink)]">
            components/ui/
          </code>
          . Everything here is wired to CSS variables — toggle dark/light by
          adding{" "}
          <code className="font-mono text-xs text-[color:var(--ink)]">
            .light
          </code>{" "}
          to <code className="font-mono text-xs text-[color:var(--ink)]">
            html
          </code>{" "}
          in devtools to preview.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold text-[color:var(--ink)]">
            Tokens
          </h2>
          <span className="text-xs text-[color:var(--ink-3)]">
            Defined in <code className="font-mono">app/globals.css</code>
          </span>
        </div>
        <TokenGrid title="Surfaces" tokens={SURFACES} />
        <TokenGrid title="Ink" tokens={INK} />
        <TokenGrid title="Signal" tokens={SIGNAL} />
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold text-[color:var(--ink)]">
            DataTable
          </h2>
          <span className="text-xs text-[color:var(--ink-3)]">
            <code className="font-mono">components/ui/data-table.tsx</code>
          </span>
        </div>
        <p className="text-sm text-[color:var(--ink-2)]">
          Press{" "}
          <kbd className="rounded border border-[color:var(--line)] bg-[color:var(--surface)] px-1.5 py-0.5 font-mono text-[10px]">
            /
          </kbd>{" "}
          to focus the filter,{" "}
          <kbd className="rounded border border-[color:var(--line)] bg-[color:var(--surface)] px-1.5 py-0.5 font-mono text-[10px]">
            j
          </kbd>
          /
          <kbd className="rounded border border-[color:var(--line)] bg-[color:var(--surface)] px-1.5 py-0.5 font-mono text-[10px]">
            k
          </kbd>{" "}
          to move the active row, and{" "}
          <kbd className="rounded border border-[color:var(--line)] bg-[color:var(--surface)] px-1.5 py-0.5 font-mono text-[10px]">
            ⌘
          </kbd>
          -click (or{" "}
          <kbd className="rounded border border-[color:var(--line)] bg-[color:var(--surface)] px-1.5 py-0.5 font-mono text-[10px]">
            ⏎
          </kbd>
          ) to open a row.
        </p>
        <DataTable<Transaction>
          id="playground-transactions"
          columns={COLUMNS}
          data={SAMPLE_ROWS}
          filterPlaceholder="Filter merchants, categories…"
          onRowOpen={(row) => setLastOpened(row)}
        />
        {lastOpened ? (
          <p className="text-xs text-[color:var(--ink-3)]">
            Last opened:{" "}
            <code className="font-mono text-[color:var(--ink)]">
              {lastOpened.id}
            </code>{" "}
            · {lastOpened.merchant}
          </p>
        ) : (
          <p className="text-xs text-[color:var(--ink-3)]">
            Open a row to see the callback fire here.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold text-[color:var(--ink)]">
            Keyboard
          </h2>
          <span className="text-xs text-[color:var(--ink-3)]">
            <code className="font-mono">components/layout/shortcuts.tsx</code>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { keys: ["⌘", "K"], label: "Open command palette" },
            { keys: ["g", "d"], label: "Go to Dashboard" },
            { keys: ["g", "r"], label: "Go to Runway" },
            { keys: ["g", "i"], label: "Go to Invoices" },
            { keys: ["g", "s"], label: "Go to Spending" },
            { keys: ["g", "f"], label: "Go to Funding" },
            { keys: ["g", "x"], label: "Go to Inbox (Phase 1.F)" },
            { keys: ["g", ","], label: "Go to Settings" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2"
            >
              <span className="text-sm text-[color:var(--ink)]">{s.label}</span>
              <span className="inline-flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={`${s.label}-${i}`}
                    className="rounded border border-[color:var(--line)] bg-[color:var(--bg)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--ink-2)]"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[color:var(--ink-3)]">
          Chords reset after 1.2s. Shortcuts are suppressed while focus is
          inside an input, textarea, or contenteditable element.
        </p>
      </section>
    </div>
  )
}
