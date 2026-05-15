# Phase 0.D — Design System Primitives

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace shadcn's default palette with the oklch tokens from `docs/DESIGN_SYSTEM.md`; default to dark mode; audit and trim unused shadcn components; ship `<DataTable>` (on `@tanstack/react-table`) and `<CommandPalette>` (Cmd-K).

**Architecture:** Token-driven. The CSS custom properties live in `app/globals.css`; Tailwind v4 reads them through its `@theme` directive. Components use `bg-[color:var(--surface)]` style classes so we never hardcode hex.

**Tech Stack:** Tailwind v4, shadcn/ui, `@tanstack/react-table` (installed by 0.A), `cmdk` (already in `package.json`).

**Dependencies:**
- 0.A installs `@tanstack/react-table`. If 0.A hasn't landed yet, run `pnpm add @tanstack/react-table` first.
- 0.C uses these tokens — its components reference `var(--accent)`, `var(--danger)`, etc.

**Skills:** `foundershq-conventions`, `frontend-design:frontend-design`, `vercel:shadcn`, `vercel:nextjs`.

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `frontend/app/globals.css` | modify | replace tokens; dark default |
| `frontend/tailwind.config.ts` (or .mjs) | modify/create | wire tokens; remove unused colors |
| `frontend/components/ui/data-table.tsx` | create | sortable, sticky, keyboard-nav table |
| `frontend/components/ui/command-palette.tsx` | create | Cmd-K palette |
| `frontend/components/ui/(audit)` | delete unused | `menubar.tsx`, `accordion.tsx`, `aspect-ratio.tsx` if no consumer |
| `frontend/components/layout/shortcuts.tsx` | create | global keyboard handler (Cmd-K opens palette, g d / g r etc) |
| `frontend/app/(dev)/design-system/page.tsx` | create | gallery of primitives + data-table + palette |

---

## Task 1 — oklch tokens in `globals.css`

**Files:** `frontend/app/globals.css` (replace top-of-file `:root` and `.dark`).

- [ ] **Step 1: Inspect current globals.css**

Open the file. Note: Tailwind v4 directives at the top, existing CSS variables (likely the shadcn defaults).

- [ ] **Step 2: Replace tokens**

Replace the existing `:root { ... }` and `.dark { ... }` blocks with:

```css
:root {
  --bg: oklch(0.99 0.005 100);
  --surface: oklch(0.97 0.005 100);
  --surface-2: oklch(0.94 0.008 100);
  --ink: oklch(0.18 0.02 250);
  --ink-2: oklch(0.38 0.02 250);
  --ink-3: oklch(0.58 0.02 250);
  --line: oklch(0.90 0.01 250);
  --accent: oklch(0.55 0.18 145);
  --accent-ink: oklch(0.99 0 0);
  --warn: oklch(0.78 0.15 75);
  --danger: oklch(0.58 0.20 25);
  --info: oklch(0.55 0.15 230);
}

.dark, :root {
  /* Default to dark; light overrides above are scoped to .light */
  --bg: oklch(0.16 0.01 250);
  --surface: oklch(0.19 0.012 250);
  --surface-2: oklch(0.23 0.014 250);
  --ink: oklch(0.96 0.005 100);
  --ink-2: oklch(0.78 0.01 250);
  --ink-3: oklch(0.58 0.01 250);
  --line: oklch(0.32 0.01 250);
  --accent: oklch(0.78 0.18 145);
  --warn: oklch(0.82 0.16 75);
  --danger: oklch(0.70 0.20 25);
  --info: oklch(0.62 0.15 230);
}

.light {
  --bg: oklch(0.99 0.005 100);
  --surface: oklch(0.97 0.005 100);
  --surface-2: oklch(0.94 0.008 100);
  --ink: oklch(0.18 0.02 250);
  --ink-2: oklch(0.38 0.02 250);
  --ink-3: oklch(0.58 0.02 250);
  --line: oklch(0.90 0.01 250);
  --accent: oklch(0.55 0.18 145);
  --warn: oklch(0.78 0.15 75);
  --danger: oklch(0.58 0.20 25);
  --info: oklch(0.55 0.15 230);
}

html, body {
  background-color: var(--bg);
  color: var(--ink);
  font-feature-settings: "ss01", "cv11", "tnum";
}

.tabular { font-variant-numeric: tabular-nums; }
```

If the existing globals.css uses shadcn's HSL palette (`--background: 0 0% 100%` etc), KEEP them under a sibling block (`:where(.shadcn-compat) { ... }`) only if existing shadcn components reference them. The cleaner path: replace them and let shadcn components inherit the new tokens via their bridging classes.

- [ ] **Step 3: Verify in `pnpm dev`**

Run `pnpm dev`. Open `/`. Confirm dark background renders. If color-scheme is broken (white-on-white), `theme-provider` may need `defaultTheme="dark"` (check `components/theme-provider.tsx`).

- [ ] **Step 4: Theme-provider — default dark**

In `frontend/components/theme-provider.tsx` (or wherever `next-themes` is wrapped), set `defaultTheme="dark" enableSystem`.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/globals.css frontend/components/theme-provider.tsx
git commit -m "feat(phase-0.D): oklch tokens + dark default"
```

---

## Task 2 — Audit unused shadcn components

**Files:** Delete unused ones in `frontend/components/ui/`.

- [ ] **Step 1: List unused components**

Run:

```bash
cd frontend
for f in components/ui/*.tsx; do
  name=$(basename "$f" .tsx)
  # search for imports — heuristic
  uses=$(grep -r --include='*.tsx' --include='*.ts' "from .*components/ui/${name}" app components lib 2>/dev/null | wc -l)
  echo "$uses $name"
done | sort -n
```

Components reported with `0` imports are candidates for deletion.

- [ ] **Step 2: Confirm and delete**

Strong candidates per DESIGN_SYSTEM.md ("we likely don't need menubar, aspect-ratio, accordion for finance UX; keep small"):
- `menubar.tsx`
- `aspect-ratio.tsx`
- `accordion.tsx` (only if 0 imports confirmed)

For each confirmed-unused: `git rm frontend/components/ui/<name>.tsx`.

Also remove the corresponding `@radix-ui/react-*` dependency from `frontend/package.json` if nothing else uses it. Run `pnpm install` to update the lockfile.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ui/ frontend/package.json frontend/pnpm-lock.yaml
git commit -m "chore(phase-0.D): trim unused shadcn components"
```

---

## Task 3 — `<DataTable>` on `@tanstack/react-table`

**Files:** Create `frontend/components/ui/data-table.tsx`.

Requirements per `docs/DESIGN_SYSTEM.md`:
- Column sort + multi-column sort.
- Sticky header + sticky first column on horizontal scroll.
- Cmd-click row → callback (parent opens RecordSheet).
- Row selection with bulk-action bar.
- Empty-after-filter ≠ no-data-at-all.
- Keyboard nav: `j`/`k` and arrows; `/` focuses filter input.

- [ ] **Step 1: Confirm dep present**

Run: `pnpm ls @tanstack/react-table`
Expected: a version is listed (installed by 0.A). If not, run `pnpm add @tanstack/react-table` first.

- [ ] **Step 2: Implement**

```tsx
// frontend/components/ui/data-table.tsx
"use client"
import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { cn } from "@/lib/utils"

type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  emptyAfterFilter?: React.ReactNode
  emptyNoData?: React.ReactNode
  onRowOpen?: (row: T) => void
  filterPlaceholder?: string
  initialFilter?: string
  className?: string
}

export function DataTable<T>({
  columns,
  data,
  emptyAfterFilter,
  emptyNoData,
  onRowOpen,
  filterPlaceholder = "Filter…",
  initialFilter = "",
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState(initialFilter)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const filterRef = React.useRef<HTMLInputElement>(null)

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.key === "/") {
        e.preventDefault()
        filterRef.current?.focus()
      } else if (e.key === "j" || e.key === "ArrowDown") {
        setActiveIndex((i) => Math.min(i + 1, table.getRowModel().rows.length - 1))
      } else if (e.key === "k" || e.key === "ArrowUp") {
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter") {
        const row = table.getRowModel().rows[activeIndex]
        if (row) onRowOpen?.(row.original)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [table, activeIndex, onRowOpen])

  const rows = table.getRowModel().rows

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <input
          ref={filterRef}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder={filterPlaceholder}
          className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface,transparent)] px-2 py-1 text-sm outline-none focus:border-[color:var(--accent)]"
        />
        <span className="text-xs text-[color:var(--ink-3)]">Press <kbd>/</kbd> to filter, <kbd>j</kbd>/<kbd>k</kbd> to navigate</span>
      </div>
      <div className="relative overflow-auto rounded-md border border-[color:var(--line)]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[color:var(--surface)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h, idx) => (
                  <th
                    key={h.id}
                    scope="col"
                    onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                    className={cn(
                      "select-none border-b border-[color:var(--line)] px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[color:var(--ink-2)]",
                      idx === 0 && "sticky left-0 bg-[color:var(--surface)]",
                      h.column.getCanSort() && "cursor-pointer",
                    )}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-sm text-[color:var(--ink-3)]">
                  {data.length === 0 ? emptyNoData ?? "No records yet." : emptyAfterFilter ?? "No matches."}
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr
                key={row.id}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) onRowOpen?.(row.original)
                }}
                className={cn(
                  "cursor-default border-b border-[color:var(--line)] last:border-b-0",
                  i === activeIndex && "bg-[color:var(--surface-2)]",
                )}
              >
                {row.getVisibleCells().map((cell, idx) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "px-3 py-2 tabular-nums",
                      idx === 0 && "sticky left-0 bg-[color:var(--surface)]",
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Render in the dev playground**

Add a `<DataTable>` section to `frontend/app/(dev)/design-system/page.tsx` (created below in Task 5).

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/data-table.tsx
git commit -m "feat(phase-0.D): <DataTable> on @tanstack/react-table"
```

---

## Task 4 — `<CommandPalette>` (Cmd-K)

**Files:**
- Create: `frontend/components/ui/command-palette.tsx`
- Create: `frontend/components/layout/shortcuts.tsx`
- Modify: `frontend/components/providers.tsx` (mount `<Shortcuts>` once)

Builds on the already-installed `cmdk` package.

- [ ] **Step 1: Implement palette**

```tsx
// frontend/components/ui/command-palette.tsx
"use client"
import * as React from "react"
import { Command } from "cmdk"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

type PageEntry = { label: string; path: string; shortcut?: string }

const PAGES: PageEntry[] = [
  { label: "Dashboard", path: "/dashboard", shortcut: "g d" },
  { label: "Runway", path: "/runway", shortcut: "g r" },
  { label: "Invoices", path: "/invoices", shortcut: "g i" },
  { label: "Spending", path: "/spending", shortcut: "g s" },
  { label: "Funding", path: "/funding", shortcut: "g f" },
  { label: "Settings", path: "/settings", shortcut: "g ," },
]

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")

  function go(path: string) {
    router.push(path)
    onOpenChange(false)
    setQuery("")
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/40 pt-[10vh]" onClick={() => onOpenChange(false)}>
      <div
        className="w-full max-w-xl rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command shouldFilter>
          <div className="flex items-center gap-2 border-b border-[color:var(--line)] px-3 py-2">
            <Search size={14} className="opacity-60" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, transactions, invoices…"
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <kbd className="text-xs text-[color:var(--ink-3)]">esc</kbd>
          </div>
          <Command.List className="max-h-96 overflow-auto p-2">
            <Command.Empty className="px-2 py-6 text-center text-sm text-[color:var(--ink-3)]">No matches.</Command.Empty>
            <Command.Group heading="Pages" className="text-xs uppercase tracking-wide text-[color:var(--ink-3)]">
              {PAGES.map((p) => (
                <Command.Item
                  key={p.path}
                  value={p.label}
                  onSelect={() => go(p.path)}
                  className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm aria-selected:bg-[color:var(--surface-2)]"
                >
                  <span>{p.label}</span>
                  {p.shortcut && <kbd className="text-xs text-[color:var(--ink-3)]">{p.shortcut}</kbd>}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Global shortcut handler**

`frontend/components/layout/shortcuts.tsx`:

```tsx
"use client"
import * as React from "react"
import { useRouter } from "next/navigation"
import { CommandPalette } from "@/components/ui/command-palette"

const PAGE_MAP: Record<string, string> = {
  d: "/dashboard",
  r: "/runway",
  i: "/invoices",
  s: "/spending",
  f: "/funding",
  x: "/inbox",
}

export function Shortcuts() {
  const [open, setOpen] = React.useState(false)
  const [chord, setChord] = React.useState<string | null>(null)
  const router = useRouter()

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      if (e.key === "g" && !chord) {
        setChord("g")
        window.setTimeout(() => setChord(null), 1200)
        return
      }
      if (chord === "g" && PAGE_MAP[e.key]) {
        e.preventDefault()
        router.push(PAGE_MAP[e.key])
        setChord(null)
      }
      if (e.key === "Escape") {
        setOpen(false)
        setChord(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [chord, router])

  return <CommandPalette open={open} onOpenChange={setOpen} />
}
```

- [ ] **Step 3: Mount `<Shortcuts />` in `providers.tsx`** (inside the theme provider, once).

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/command-palette.tsx frontend/components/layout/shortcuts.tsx frontend/components/providers.tsx
git commit -m "feat(phase-0.D): <CommandPalette> + Cmd-K + g-prefix shortcuts"
```

---

## Task 5 — Design-system playground (dev-only)

**Files:** Create `frontend/app/(dev)/design-system/page.tsx`.

```tsx
"use client"
import { Money, MetricCard, EvidenceChip, DeltaBadge, Sparkline } from "@/components/finance"
import { DataTable } from "@/components/ui/data-table"

const rows = [
  { id: "txn_001", merchant: "AWS", amount: 4200, category: "Cloud" },
  { id: "txn_002", merchant: "Gusto", amount: 28500, category: "Payroll" },
  { id: "txn_003", merchant: "Notion", amount: 84, category: "SaaS" },
]

export default function DesignSystemPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Design system</h1>
      <section className="grid grid-cols-3 gap-3">
        <MetricCard label="Net Burn" value={<Money value={42500} currency="USD" />} delta={3.2} spark={[10, 12, 14, 13, 16, 18]} />
        <MetricCard label="Runway" value={<Money value={11} unit="weeks" precision={1} />} delta={-8.1} />
        <MetricCard label="Cash" value={<Money value={325000} currency="USD" />} delta={0} />
      </section>
      <section className="space-y-2">
        <DataTable
          columns={[
            { accessorKey: "id", header: "ID" },
            { accessorKey: "merchant", header: "Merchant" },
            { accessorKey: "amount", header: "Amount", cell: (c) => <Money value={c.row.original.amount} currency="USD" /> },
            { accessorKey: "category", header: "Category" },
          ]}
          data={rows}
          onRowOpen={(r) => console.log("open", r)}
        />
      </section>
      <section className="flex items-center gap-4">
        <EvidenceChip ids={["txn_001", "txn_002"]} kind="transaction" />
        <DeltaBadge value={-12.4} />
        <DeltaBadge value={4.2} />
        <Sparkline data={[2, 3, 1, 4, 3, 5, 4]} trend="up" />
      </section>
      <p className="text-xs text-[color:var(--ink-3)]">Try Cmd-K to open the palette. Type "j"/"k" in the table to navigate.</p>
    </div>
  )
}
```

- [ ] Commit:

```bash
git add frontend/app/\(dev\)/design-system/page.tsx
git commit -m "chore(phase-0.D): design-system playground"
```

---

## Success criteria

- Dark mode renders by default; `--bg`, `--surface`, `--ink`, `--accent`, `--danger` all visibly applied.
- `<DataTable>` sorts, filters with `/`, navigates with `j`/`k`, and Cmd-click opens a row.
- `Cmd-K` opens `<CommandPalette>`; `g d`, `g r`, `g i`, `g s`, `g f`, `g x` navigate.
- Unused shadcn primitives are deleted, their Radix deps removed.
- `/(dev)/design-system` renders the gallery in `pnpm dev`.

## Out of scope

- Real Cmd-K search over transactions/invoices/customers (phase 1.F).
- Storybook setup.
- Tailwind v4 `@theme` directive nuances beyond CSS variables — we can refine if needed when tokens are referenced through Tailwind utility classes elsewhere.

## Verification

- [ ] `pnpm dev` boots, `/` is dark by default.
- [ ] `pnpm exec tsc --noEmit` shows 0 errors in `components/ui/data-table.tsx` and `components/ui/command-palette.tsx`.
- [ ] Playwright snapshot of `/(dev)/design-system` does not change between runs (deterministic).
