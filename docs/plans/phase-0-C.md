# Phase 0.C — Cross-cutting Frontend Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Land the load-bearing frontend primitives every other surface will use: the SSE client, the per-domain query files (replacing the `hooks.ts` monolith), `lib/permissions.ts`, and the finance component family (`Money`, `Sparkline`, `EvidenceChip`, `DeltaBadge`, `MetricCard`, `ScenarioDiff`). Remove the `IS_MOCK` branching from components that don't need it.

**Architecture:** Pure additions. Existing pages keep working off `lib/api/hooks.ts` until each domain hook is migrated. Finance components live under `frontend/components/finance/` and use the design tokens that 0.D produces — so we author against the **target** tokens (oklch CSS variables) and add a thin fallback for the few cases where 0.D hasn't landed yet.

**Tech Stack:** Next.js 16 App Router, React 19, SWR, Tailwind v4, `recharts` (already installed), `lucide-react` (already installed).

**Dependencies:**
- 0.A installs `@tanstack/react-table` and adds the `verify` script. Not strictly required by 0.C, but 0.C should not modify `package.json`.
- 0.D writes the oklch tokens. If 0.C lands first, the finance components will read CSS variables that don't exist yet — they degrade to default `currentColor`. 0.D will fill the tokens in.
- 0.B is independent (different repo half).

**Skills to load:** `foundershq-conventions`, `superpowers:test-driven-development`, `frontend-design:frontend-design`, `vercel:nextjs`, `vercel:shadcn`.

**Out of scope:**
- Wiring SSE to live mutations (phase 2).
- RBAC backend (phase 1) — `lib/permissions.ts` is UX-only.
- Visual changes to existing pages (we're only adding primitives).

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `frontend/components/finance/money.tsx` | create | `<Money>` |
| `frontend/components/finance/sparkline.tsx` | create | tiny chart |
| `frontend/components/finance/evidence-chip.tsx` | create | pill linking to a UUID |
| `frontend/components/finance/delta-badge.tsx` | create | `+3.2%` or `–$1,200` |
| `frontend/components/finance/metric-card.tsx` | create | headline number + label + spark |
| `frontend/components/finance/scenario-diff.tsx` | create | two-up scenarios |
| `frontend/components/finance/index.ts` | create | re-exports |
| `frontend/lib/realtime.ts` | create | SSE client + outbox catch-up |
| `frontend/lib/permissions.ts` | create | role guards (UX only) |
| `frontend/lib/api/queries/dashboard.ts` | create | migrated from hooks.ts |
| `frontend/lib/api/queries/spending.ts` | create | migrated from hooks.ts |
| `frontend/lib/api/queries/invoices.ts` | create | migrated from hooks.ts |
| `frontend/lib/api/queries/runway.ts` | create | migrated from hooks.ts |
| `frontend/lib/api/queries/funding.ts` | create | migrated from hooks.ts |
| `frontend/lib/api/queries/search.ts` | create | migrated from hooks.ts |
| `frontend/lib/api/queries/llm.ts` | create | migrated from hooks.ts |
| `frontend/lib/api/queries/index.ts` | create | re-exports |
| `frontend/lib/api/hooks.ts` | modify | re-export from `queries/*` for backward compat |
| `frontend/lib/api/__mocks__/data.ts` | create (or move existing) | mock fixtures isolated |
| `frontend/components/finance/*.test.tsx` | create | colocated unit tests (vitest or jest — pick whichever is already configured; if none, skip jest setup in this workstream and rely on Playwright |

> **Testing note:** the repo has no JS test runner today. Rather than introduce vitest here, write **type-level** tests (component renders without TS errors) and one Playwright smoke test per primitive demonstrating it renders. Add a `frontend/components/finance/_playground/page.tsx` (excluded from production routes — use `(dev)` group) that renders each primitive so Playwright can snapshot it. If that route group becomes intrusive, gate it behind `process.env.NODE_ENV !== "production"`.

---

## Task 1 — `<Money>` component

**Files:**
- Create: `frontend/components/finance/money.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/components/finance/money.tsx
"use client"
import { cn } from "@/lib/utils"

type MoneyProps = {
  value: number
  currency?: string
  unit?: "weeks" | "months" | "days"
  precision?: number
  signed?: boolean
  baseCurrency?: string  // if provided & differs, hover reveals base
  className?: string
}

export function Money({
  value,
  currency = "USD",
  unit,
  precision,
  signed = false,
  baseCurrency,
  className,
}: MoneyProps) {
  const isNegative = value < 0
  const abs = Math.abs(value)
  let formatted: string

  if (unit) {
    const p = precision ?? 1
    formatted = `${abs.toFixed(p)} ${unit}`
  } else {
    try {
      formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: precision ?? 2,
        maximumFractionDigits: precision ?? 2,
      }).format(abs)
    } catch {
      formatted = `${currency} ${abs.toFixed(precision ?? 2)}`
    }
  }

  // en-dash for negatives (U+2013), not hyphen-minus
  const sign = isNegative ? "–" : signed && value > 0 ? "+" : ""

  return (
    <span
      className={cn(
        "tabular-nums",
        isNegative && "text-[color:var(--danger,inherit)]",
        signed && !isNegative && value > 0 && "text-[color:var(--accent,inherit)]",
        className,
      )}
      title={baseCurrency && baseCurrency !== currency ? `in ${baseCurrency}` : undefined}
    >
      {sign}
      {formatted}
    </span>
  )
}
```

- [ ] **Step 2: Type check passes**

Run: `cd frontend && pnpm exec tsc --noEmit components/finance/money.tsx`
Expected: 0 errors for this file.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/finance/money.tsx
git commit -m "feat(phase-0.C): <Money> component"
```

---

## Task 2 — `<Sparkline>` component

**Files:** Create `frontend/components/finance/sparkline.tsx`.

- [ ] **Step 1: Implement**

```tsx
"use client"
import { Line, LineChart, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"

type Point = { x: number; y: number }

export function Sparkline({
  data,
  width = 60,
  height = 18,
  trend = "neutral",
  className,
}: {
  data: Point[] | number[]
  width?: number
  height?: number
  trend?: "up" | "down" | "neutral"
  className?: string
}) {
  const points: Point[] = data.map((d, i) =>
    typeof d === "number" ? { x: i, y: d } : d
  )
  const color =
    trend === "up"
      ? "var(--accent, currentColor)"
      : trend === "down"
        ? "var(--danger, currentColor)"
        : "var(--ink-3, currentColor)"
  return (
    <span className={cn("inline-block align-middle", className)} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line type="monotone" dataKey="y" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </span>
  )
}
```

- [ ] **Step 2: tsc clean.**

- [ ] **Step 3: Commit**

```bash
git add frontend/components/finance/sparkline.tsx
git commit -m "feat(phase-0.C): <Sparkline>"
```

---

## Task 3 — `<EvidenceChip>` and RecordSheet entry hook

**Files:** Create `frontend/components/finance/evidence-chip.tsx`.

- [ ] **Step 1: Implement (linkable pill, opens RecordSheet via callback prop)**

```tsx
"use client"
import { Receipt } from "lucide-react"
import { cn } from "@/lib/utils"

export type EvidenceKind = "transaction" | "invoice" | "commitment" | "vendor_finding" | "insight"

export function EvidenceChip({
  ids,
  kind = "transaction",
  onOpen,
  className,
}: {
  ids: string[]
  kind?: EvidenceKind
  onOpen?: (id: string, kind: EvidenceKind) => void
  className?: string
}) {
  if (!ids.length) return null
  const label = ids.length === 1 ? "1 source" : `${ids.length} sources`
  return (
    <button
      type="button"
      onClick={() => ids[0] && onOpen?.(ids[0], kind)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] bg-[color:var(--surface-2,transparent)]",
        "px-2 py-0.5 text-xs text-[color:var(--ink-2,inherit)] hover:bg-[color:var(--surface-2)]",
        "tabular-nums",
        className,
      )}
      aria-label={`Evidence: ${ids.length} item${ids.length > 1 ? "s" : ""}`}
    >
      <Receipt size={12} className="opacity-70" />
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/finance/evidence-chip.tsx
git commit -m "feat(phase-0.C): <EvidenceChip>"
```

---

## Task 4 — `<DeltaBadge>`

**Files:** Create `frontend/components/finance/delta-badge.tsx`.

- [ ] **Step 1: Implement**

```tsx
"use client"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export function DeltaBadge({
  value,
  format = "percent",
  className,
}: {
  value: number
  format?: "percent" | "currency" | "absolute"
  className?: string
}) {
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat"
  const abs = Math.abs(value)
  let body: string
  if (format === "percent") body = `${abs.toFixed(1)}%`
  else if (format === "currency") body = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(abs)
  else body = abs.toLocaleString()

  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus
  const color =
    dir === "up"
      ? "text-[color:var(--accent,inherit)]"
      : dir === "down"
        ? "text-[color:var(--danger,inherit)]"
        : "text-[color:var(--ink-3,inherit)]"
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs tabular-nums", color, className)}>
      <Icon size={12} />
      {body}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/finance/delta-badge.tsx
git commit -m "feat(phase-0.C): <DeltaBadge>"
```

---

## Task 5 — `<MetricCard>`

**Files:** Create `frontend/components/finance/metric-card.tsx`.

- [ ] **Step 1: Implement (two density levels — `compact` / `expanded`)**

```tsx
"use client"
import { Sparkline } from "./sparkline"
import { DeltaBadge } from "./delta-badge"
import { EvidenceChip, type EvidenceKind } from "./evidence-chip"
import { cn } from "@/lib/utils"

export function MetricCard({
  label,
  value,
  delta,
  spark,
  evidenceIds,
  evidenceKind,
  onOpenEvidence,
  density = "compact",
  className,
}: {
  label: string
  value: React.ReactNode
  delta?: number
  spark?: number[]
  evidenceIds?: string[]
  evidenceKind?: EvidenceKind
  onOpenEvidence?: (id: string, kind: EvidenceKind) => void
  density?: "compact" | "expanded"
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-[color:var(--line)] bg-[color:var(--surface,transparent)]",
        density === "compact" ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wide text-[color:var(--ink-3,inherit)]">{label}</div>
      <div className={cn("mt-1 font-semibold leading-tight tracking-tight", density === "compact" ? "text-2xl" : "text-3xl")}>
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {delta !== undefined && <DeltaBadge value={delta} format="percent" />}
        {spark && spark.length > 1 && <Sparkline data={spark} />}
        {evidenceIds && evidenceIds.length > 0 && (
          <EvidenceChip ids={evidenceIds} kind={evidenceKind} onOpen={onOpenEvidence} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/finance/metric-card.tsx
git commit -m "feat(phase-0.C): <MetricCard>"
```

---

## Task 6 — `<ScenarioDiff>` placeholder

The full scenario diff is phase 3.A; this task lands a minimal shell so other code can reference the type.

**Files:** Create `frontend/components/finance/scenario-diff.tsx`.

```tsx
"use client"

export type ScenarioSummary = {
  id: string
  label: string
  endingCash: number
  runwayWeeks: number
}

export function ScenarioDiff({
  a,
  b,
  className,
}: {
  a: ScenarioSummary
  b: ScenarioSummary
  className?: string
}) {
  // Placeholder: phase 3.A replaces this with the full diff including charts.
  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((s) => (
          <div key={s.id} className="rounded-md border border-[color:var(--line)] p-3">
            <div className="text-xs uppercase tracking-wide text-[color:var(--ink-3,inherit)]">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{s.runwayWeeks.toFixed(1)}w</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] Commit:

```bash
git add frontend/components/finance/scenario-diff.tsx
git commit -m "feat(phase-0.C): <ScenarioDiff> placeholder"
```

---

## Task 7 — finance barrel + design-system playground route

**Files:**
- Create: `frontend/components/finance/index.ts`
- Create (dev-only): `frontend/app/(dev)/finance/page.tsx`

`frontend/components/finance/index.ts`:

```ts
export { Money } from "./money"
export { Sparkline } from "./sparkline"
export { EvidenceChip } from "./evidence-chip"
export type { EvidenceKind } from "./evidence-chip"
export { DeltaBadge } from "./delta-badge"
export { MetricCard } from "./metric-card"
export { ScenarioDiff } from "./scenario-diff"
export type { ScenarioSummary } from "./scenario-diff"
```

`frontend/app/(dev)/finance/page.tsx`:

```tsx
"use client"
import { MetricCard, Money, EvidenceChip, DeltaBadge, Sparkline } from "@/components/finance"

export default function FinancePlayground() {
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">Finance Primitives</h1>
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="Net Burn"
          value={<Money value={42500} currency="USD" />}
          delta={3.2}
          spark={[10, 12, 14, 13, 16, 18]}
          evidenceIds={["txn_001", "txn_002"]}
          evidenceKind="transaction"
        />
        <MetricCard label="Runway" value={<Money value={11} unit="weeks" precision={1} />} delta={-8.1} />
        <MetricCard label="Cash" value={<Money value={325000} currency="USD" />} delta={0} />
      </div>
      <div className="flex items-center gap-4">
        <EvidenceChip ids={["inv_001", "inv_002"]} kind="invoice" />
        <DeltaBadge value={-12.4} />
        <DeltaBadge value={4.2} />
        <Sparkline data={[2, 3, 1, 4, 3, 5, 4]} trend="up" />
      </div>
    </div>
  )
}
```

- [ ] Commit:

```bash
git add frontend/components/finance/index.ts frontend/app/\(dev\)/
git commit -m "feat(phase-0.C): finance barrel + dev playground"
```

---

## Task 8 — `lib/permissions.ts`

**Files:** Create `frontend/lib/permissions.ts`.

```ts
// UX-only role guard. Backend is the boundary; this only affects which controls render.

export type Role = "owner" | "admin" | "member" | "viewer"

const ORDER: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 }

export function hasRole(actual: Role | undefined, required: Role): boolean {
  if (!actual) return false
  return ORDER[actual] >= ORDER[required]
}

export function can(actual: Role | undefined, action: "edit" | "delete" | "invite" | "billing"): boolean {
  switch (action) {
    case "edit":
      return hasRole(actual, "member")
    case "delete":
      return hasRole(actual, "admin")
    case "invite":
      return hasRole(actual, "admin")
    case "billing":
      return hasRole(actual, "owner")
  }
}
```

- [ ] Commit:

```bash
git add frontend/lib/permissions.ts
git commit -m "feat(phase-0.C): lib/permissions.ts (UX-only)"
```

---

## Task 9 — `lib/realtime.ts` (SSE client)

**Files:** Create `frontend/lib/realtime.ts`.

The client must:
1. Open an `EventSource` to `/events` (proxied through Next API or pointed at `NEXT_PUBLIC_API_BASE_URL`).
2. Track the last received `seq`.
3. On reconnect, call `/events/replay?since={seq}` and surface those events before re-attaching to the live stream.
4. Expose `subscribe(type, handler)` and `disconnect()`.

```ts
// frontend/lib/realtime.ts
"use client"

import { API_BASE_URL } from "./api/client"

export type RealtimeEvent<T = unknown> = {
  seq: string
  type: string
  payload: T
  org_id?: string
  created_at?: string
}

type Handler = (e: RealtimeEvent) => void

class RealtimeClient {
  private es: EventSource | null = null
  private handlers = new Map<string, Set<Handler>>()
  private lastSeq: string | null = null
  private reconnectTimer: number | null = null
  private token: string | null = null

  setToken(token: string | null) {
    this.token = token
  }

  subscribe(type: string, handler: Handler): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler)
    return () => {
      set!.delete(handler)
    }
  }

  async connect() {
    if (this.es) return
    if (this.lastSeq) {
      await this.replaySince(this.lastSeq)
    }
    const url = `${API_BASE_URL}/events`
    this.es = new EventSource(url, { withCredentials: true })
    this.es.onmessage = (msg) => {
      try {
        const event: RealtimeEvent = JSON.parse(msg.data)
        if (event.seq) this.lastSeq = event.seq
        this.dispatch(event)
      } catch {}
    }
    this.es.onerror = () => {
      this.es?.close()
      this.es = null
      this.scheduleReconnect()
    }
  }

  private dispatch(event: RealtimeEvent) {
    const handlers = this.handlers.get(event.type)
    handlers?.forEach((h) => h(event))
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 2000) as unknown as number
  }

  private async replaySince(seq: string) {
    try {
      const headers: HeadersInit = this.token ? { Authorization: `Bearer ${this.token}` } : {}
      const r = await fetch(`${API_BASE_URL}/events/replay?since=${encodeURIComponent(seq)}`, { headers })
      if (!r.ok) return
      const rows: RealtimeEvent[] = await r.json()
      for (const row of rows) {
        this.lastSeq = row.seq
        this.dispatch(row)
      }
    } catch {}
  }

  disconnect() {
    this.es?.close()
    this.es = null
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}

export const realtime = new RealtimeClient()
```

If `API_BASE_URL` isn't exported from `lib/api/client.ts`, export it there (`export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"`) and reuse.

- [ ] Commit:

```bash
git add frontend/lib/realtime.ts frontend/lib/api/client.ts
git commit -m "feat(phase-0.C): SSE realtime client"
```

---

## Task 10 — Split `hooks.ts` into `lib/api/queries/<domain>.ts`

`hooks.ts` is currently ~450 lines covering 8 domains. Split it into one file per domain. Old file re-exports from new files for one cycle, then is deleted in 0.A2.

**Files:**
- Create: `frontend/lib/api/queries/dashboard.ts`
- Create: `frontend/lib/api/queries/spending.ts`
- Create: `frontend/lib/api/queries/invoices.ts`
- Create: `frontend/lib/api/queries/runway.ts`
- Create: `frontend/lib/api/queries/funding.ts`
- Create: `frontend/lib/api/queries/search.ts`
- Create: `frontend/lib/api/queries/llm.ts`
- Create: `frontend/lib/api/queries/index.ts`
- Modify: `frontend/lib/api/hooks.ts` → become a re-export shim

**Procedure (per domain):**

- [ ] **Step 1:** Open `frontend/lib/api/hooks.ts`. Identify the section block for the domain (each is fenced with a `=== Domain ===` banner).
- [ ] **Step 2:** Move the section into `frontend/lib/api/queries/<domain>.ts`. Carry the imports that section needs. Use named exports only.
- [ ] **Step 3:** While moving, fix the dangling `mapInvoice` reference in the invoice section by importing it from `mappers.ts` (add the function there if absent — match the existing `mapPaginatedInvoices` pattern by taking `Record<string, unknown>` and returning `InvoiceDTO`).
- [ ] **Step 4:** Replace the original section in `hooks.ts` with `export * from "./queries/<domain>"`.
- [ ] **Step 5:** Commit per domain:

```bash
git add frontend/lib/api/queries/<domain>.ts frontend/lib/api/hooks.ts frontend/lib/api/mappers.ts
git commit -m "refactor(phase-0.C): split <domain> hooks into queries/"
```

- [ ] **Final:** Add `frontend/lib/api/queries/index.ts`:

```ts
export * from "./dashboard"
export * from "./spending"
export * from "./invoices"
export * from "./runway"
export * from "./funding"
export * from "./search"
export * from "./llm"
```

Existing pages may continue importing from `@/lib/api/hooks`; we'll change them in phase 1.

---

## Success criteria

- `frontend/components/finance/` exports `Money`, `Sparkline`, `EvidenceChip`, `DeltaBadge`, `MetricCard`, `ScenarioDiff`.
- `frontend/lib/realtime.ts` exists and `tsc --noEmit` is clean against it.
- `frontend/lib/permissions.ts` exists.
- `frontend/lib/api/queries/<domain>.ts` exists for each of the 7 domains, and `hooks.ts` is a thin re-export shim.
- `mapInvoice` (or equivalent) is defined and the dangling reference at `hooks.ts:213` no longer points to nothing.
- Visiting `/(dev)/finance` renders six sample MetricCards without runtime error.

## Out of scope

- Disabling `typescript.ignoreBuildErrors` — that's 0.A2.
- Migrating pages off `hooks.ts` to use `queries/*` directly — phase 1.
- Wiring `realtime.subscribe(...)` into pages — phase 2.

## Verification

- [ ] `pnpm exec tsc --noEmit` over the new files reports 0 errors (existing untouched files may still error until 0.A2).
- [ ] `pnpm dev` starts and `/finance` (dev playground) renders.
- [ ] Existing pages (`/dashboard`, `/spending`, etc.) continue to work via the `hooks.ts` shim.
