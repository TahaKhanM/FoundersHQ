"use client"

import {
  DeltaBadge,
  EvidenceChip,
  MetricCard,
  Money,
  ScenarioDiff,
  Sparkline,
} from "@/components/finance"

/**
 * Dev-only playground for the finance component family.
 *
 * Phase 0.C ships the primitives; the (dev) route group keeps them out
 * of the production shell while letting Playwright snapshot them and
 * the design team review them in isolation.
 */
export default function FinancePlayground() {
  return (
    <div className="space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Finance primitives
        </h1>
        <p className="text-sm text-[color:var(--ink-3,inherit)]">
          Headline cards, evidence chips, delta badges, and sparklines.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[color:var(--ink-3,inherit)]">
          Metric cards
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricCard
            label="Net Burn"
            value={<Money value={42500} currency="USD" />}
            delta={3.2}
            spark={[10, 12, 14, 13, 16, 18]}
            evidenceIds={["txn_001", "txn_002"]}
            evidenceKind="transaction"
          />
          <MetricCard
            label="Runway"
            value={<Money value={11} unit="weeks" precision={1} />}
            delta={-8.1}
          />
          <MetricCard
            label="Cash"
            value={<Money value={325000} currency="USD" />}
            delta={0}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[color:var(--ink-3,inherit)]">
          Money
        </h2>
        <div className="flex flex-wrap items-center gap-6">
          <Money value={1234.56} />
          <Money value={-1234.56} />
          <Money value={9876} signed />
          <Money value={11} unit="weeks" precision={1} />
          <Money value={750} currency="EUR" baseCurrency="USD" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[color:var(--ink-3,inherit)]">
          Chips and badges
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <EvidenceChip ids={["inv_001"]} kind="invoice" />
          <EvidenceChip ids={["inv_001", "inv_002"]} kind="invoice" />
          <EvidenceChip
            ids={["txn_001", "txn_002", "txn_003"]}
            kind="transaction"
          />
          <DeltaBadge value={-12.4} />
          <DeltaBadge value={4.2} />
          <DeltaBadge value={0} />
          <DeltaBadge value={-1500} format="currency" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[color:var(--ink-3,inherit)]">
          Sparkline
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <Sparkline data={[2, 3, 1, 4, 3, 5, 4]} trend="up" />
          <Sparkline data={[8, 7, 6, 4, 3, 2, 1]} trend="down" />
          <Sparkline data={[5, 5, 5, 5, 5, 5, 5]} trend="neutral" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[color:var(--ink-3,inherit)]">
          Scenario diff (placeholder)
        </h2>
        <ScenarioDiff
          a={{
            id: "base",
            label: "Base case",
            endingCash: 325000,
            runwayWeeks: 24.5,
          }}
          b={{
            id: "pessimistic",
            label: "Pessimistic",
            endingCash: 210000,
            runwayWeeks: 11.0,
          }}
        />
      </section>
    </div>
  )
}
