"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { MetricCard } from "@/components/common/metric-card"
import { AlertList } from "@/components/common/alert-list"
import { RecordSheet } from "@/components/common/record-sheet"
import { PageHeader } from "@/components/common/page-header"
import { useSpendingMetrics, useAlerts, useTransactions } from "@/lib/api/hooks"
import { formatCurrency, formatPercent, formatRatio } from "@/lib/utils/format"
import { Upload } from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const categoryData = [
  { name: "Payroll", amount: 28500 },
  { name: "Cloud", amount: 4520 },
  { name: "Marketing", amount: 3200 },
  { name: "Office", amount: 2400 },
  { name: "SaaS", amount: 849 },
  { name: "Travel", amount: 780 },
  { name: "Services", amount: 0 },
]

const weeklyTrend = [
  { week: "W1", outflow: 15200 },
  { week: "W2", outflow: 18400 },
  { week: "W3", outflow: 16800 },
  { week: "W4", outflow: 17400 },
  { week: "W5", outflow: 14900 },
  { week: "W6", outflow: 19200 },
  { week: "W7", outflow: 16100 },
  { week: "W8", outflow: 17800 },
]

export default function SpendingPage() {
  const pathname = usePathname()
  const tabFromRoute = pathname === "/spending/transactions" ? "transactions" : pathname === "/spending/commitments" ? "commitments" : pathname === "/spending/rules" ? "rules" : "overview"
  const { data: metrics, isLoading } = useSpendingMetrics()
  const { data: alerts } = useAlerts()
  const { data: txnData } = useTransactions({ pageSize: 5 })
  const [sheetId, setSheetId] = useState<string | null>(null)
  const weeklyTrendFromMetrics = metrics?.reconciliation?.weekly_outflow_series
  const weeklyTrend = weeklyTrendFromMetrics?.length
    ? weeklyTrendFromMetrics.map((w, i) => ({ week: `W${i + 1}`, outflow: Number(w.total_outflow) }))
    : []

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
        <TabsList className="w-full justify-start flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" asChild><Link href="/spending">Overview</Link></TabsTrigger>
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
          {/* Metrics */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="Total Outflow (30d)" value={formatCurrency(metrics.totalOutflow30d)} tooltip="Total cash out in the last 30 days" />
              <MetricCard title="Net Burn (30d)" value={formatCurrency(metrics.netBurn30d)} deltaDirection="down" tooltip="Net cash burn including revenue" />
              <MetricCard title="Run Rate" value={formatCurrency(metrics.runRateOutflow)} tooltip="Annualized outflow run rate" />
              <MetricCard title="Spend Creep" value={formatPercent(metrics.spendCreepPct)} deltaDirection="up" delta="MoM" tooltip="Month-over-month spending increase" />
              <MetricCard title="Cash Weeks" value={`${metrics.cashWeeks}`} tooltip="Weeks of runway at current burn" />
              <MetricCard title="Buffer Ratio" value={formatRatio(metrics.bufferRatio)} tooltip="Cash / monthly burn" />
              <MetricCard title="Revenue Gap" value={formatCurrency(metrics.revenueBreakevenGap)} deltaDirection="down" tooltip="Gap to revenue breakeven" />
            </div>
          ) : null}

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Category Outflow (Monthly Run Rate)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} fontSize={12} />
                    <YAxis type="category" dataKey="name" width={70} fontSize={12} />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toLocaleString()}`, "Amount"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Weekly Outflow Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {weeklyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" fontSize={12} />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} fontSize={12} />
                      <Tooltip
                        formatter={(value: number) => [`$${value.toLocaleString()}`, "Outflow"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey="outflow" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No data for selected period.</p>
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
                  <div key={txn.txnId} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{txn.canonicalMerchant}</p>
                      <p className="text-xs text-muted-foreground">{txn.categoryName}</p>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrency(Math.abs(txn.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Spending Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <AlertList
                alerts={(alerts ?? []).filter((a) => a.type === "spend_creep" || a.type === "high_burn")}
                onClickEvidenceId={setSheetId}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecordSheet open={!!sheetId} onOpenChange={() => setSheetId(null)} evidenceId={sheetId} />
    </>
  )
}
