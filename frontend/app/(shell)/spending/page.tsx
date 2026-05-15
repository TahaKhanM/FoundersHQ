"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Upload } from "lucide-react"

import { AlertList } from "@/components/common/alert-list"
import { PageHeader } from "@/components/common/page-header"
import { RecordSheet } from "@/components/common/record-sheet"
import { PageError } from "@/components/dashboard/page-error"
import { EvidenceChip, MetricCard, Money } from "@/components/finance"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useAlerts,
  useSpendingMetrics,
  useTransactions,
} from "@/lib/api/queries/spending"
import { formatCurrency } from "@/lib/utils/format"

const METRIC_LABELS = [
  "Total Outflow (30d)",
  "Net Burn (30d)",
  "Run Rate",
  "Spend Creep",
  "Cash Weeks",
  "Buffer Ratio",
  "Revenue Gap",
] as const

export default function SpendingPage() {
  const pathname = usePathname()
  const tabFromRoute =
    pathname === "/spending/transactions"
      ? "transactions"
      : pathname === "/spending/commitments"
        ? "commitments"
        : pathname === "/spending/rules"
          ? "rules"
          : "overview"

  const {
    data: metrics,
    isLoading,
    error,
    mutate,
  } = useSpendingMetrics()
  const { data: alerts } = useAlerts()
  const { data: txnData } = useTransactions({ pageSize: 5 })
  const [sheetId, setSheetId] = useState<string | null>(null)

  const weeklyTrend = useMemo(() => {
    const series = metrics?.reconciliation?.weekly_outflow_series ?? []
    return series.map((w, i) => ({
      week: `W${i + 1}`,
      outflow: Number(w.total_outflow),
    }))
  }, [metrics?.reconciliation?.weekly_outflow_series])

  const categoryData = useMemo(() => {
    // Synthesize a category breakdown from recent txns until backend ships one.
    const out = new Map<string, number>()
    for (const t of txnData?.data ?? []) {
      if (t.amount < 0) {
        const cur = out.get(t.categoryName) ?? 0
        out.set(t.categoryName, cur + Math.abs(t.amount))
      }
    }
    return Array.from(out.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 7)
  }, [txnData?.data])

  return (
    <>
      <PageHeader
        title="Spending Health"
        description="Analyze and control your startup spend"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/spending/transactions">
              <Upload className="mr-2 h-4 w-4" />
              Upload CSV
            </Link>
          </Button>
        }
      />

      <Tabs value={tabFromRoute} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview" asChild>
            <Link href="/spending">Overview</Link>
          </TabsTrigger>
          <TabsTrigger value="transactions" asChild>
            <Link href="/spending/transactions">Transactions</Link>
          </TabsTrigger>
          <TabsTrigger value="commitments" asChild>
            <Link href="/spending/commitments">Commitments</Link>
          </TabsTrigger>
          <TabsTrigger value="rules" asChild>
            <Link href="/spending/rules">Rules</Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          {error ? (
            <PageError
              error={error}
              title="Couldn't load spending metrics."
              onRetry={() => void mutate()}
            />
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {METRIC_LABELS.map((label) => (
                <div
                  key={label}
                  className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] p-3"
                >
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="mt-2 h-7 w-28 rounded" />
                </div>
              ))}
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total Outflow (30d)"
                value={<Money value={-metrics.totalOutflow30d} />}
              />
              <MetricCard
                label="Net Burn (30d)"
                value={<Money value={metrics.netBurn30d} />}
              />
              <MetricCard
                label="Run Rate"
                value={<Money value={-metrics.runRateOutflow} />}
              />
              <MetricCard
                label="Spend Creep"
                value={`${metrics.spendCreepPct.toFixed(1)}%`}
                delta={metrics.spendCreepPct}
              />
              <MetricCard
                label="Cash Weeks"
                value={<Money value={metrics.cashWeeks} unit="weeks" />}
              />
              <MetricCard
                label="Buffer Ratio"
                value={`${metrics.bufferRatio.toFixed(1)}x`}
              />
              <MetricCard
                label="Revenue Gap"
                value={<Money value={metrics.revenueBreakevenGap} signed />}
              />
            </div>
          ) : null}

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Category Outflow (recent)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categoryData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No transactions yet.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={categoryData}
                      layout="vertical"
                      margin={{ left: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--line)"
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        fontSize={11}
                        tick={{ fill: "var(--ink-3)" }}
                        stroke="var(--line)"
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        fontSize={11}
                        tick={{ fill: "var(--ink-2)" }}
                        stroke="var(--line)"
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          formatCurrency(value),
                          "Amount",
                        ]}
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "var(--ink)",
                        }}
                        cursor={{ fill: "var(--surface-2)" }}
                      />
                      <Bar
                        dataKey="amount"
                        fill="var(--accent)"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Weekly Outflow Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {weeklyTrend.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No data for selected period.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={weeklyTrend}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--line)"
                      />
                      <XAxis
                        dataKey="week"
                        fontSize={11}
                        tick={{ fill: "var(--ink-3)" }}
                        stroke="var(--line)"
                      />
                      <YAxis
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        fontSize={11}
                        tick={{ fill: "var(--ink-3)" }}
                        stroke="var(--line)"
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          formatCurrency(value),
                          "Outflow",
                        ]}
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "var(--ink)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="outflow"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "var(--accent)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Vendors */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(txnData?.data ?? [])
                  .filter((t) => t.amount < 0)
                  .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                  .slice(0, 5)
                  .map((txn) => (
                    <div
                      key={txn.txnId}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {txn.canonicalMerchant}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {txn.categoryName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Money value={txn.amount} />
                        <EvidenceChip
                          ids={[txn.txnId]}
                          kind="transaction"
                          onOpen={(id) => setSheetId(id)}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Spending Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AlertList
                alerts={(alerts ?? []).filter(
                  (a) => a.type === "spend_creep" || a.type === "high_burn",
                )}
                onClickEvidenceId={setSheetId}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecordSheet
        open={!!sheetId}
        onOpenChange={() => setSheetId(null)}
        evidenceId={sheetId}
      />
    </>
  )
}
