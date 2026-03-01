"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { MetricCard } from "@/components/common/metric-card"
import { AlertList } from "@/components/common/alert-list"
import { RecordSheet } from "@/components/common/record-sheet"
import { useInvoiceMetrics, useAlerts, useCustomers } from "@/lib/api/hooks"
import { formatCurrency } from "@/lib/utils/format"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export default function InvoicesPage() {
  const { data: metrics, isLoading } = useInvoiceMetrics()
  const { data: alerts } = useAlerts()
  const { data: customers } = useCustomers()
  const [sheetId, setSheetId] = useState<string | null>(null)

  const ageingData = metrics
    ? [
        { bucket: "0-7d", amount: metrics.ageingBuckets["0-7"] },
        { bucket: "8-30d", amount: metrics.ageingBuckets["8-30"] },
        { bucket: "31-60d", amount: metrics.ageingBuckets["31-60"] },
        { bucket: "60+d", amount: metrics.ageingBuckets["60+"] },
      ]
    : []

  const riskyCustomers = customers
    ?.filter((c) => c.exposureOverdueAmount > 0)
    .sort((a, b) => b.exposureOverdueAmount - a.exposureOverdueAmount)
    .slice(0, 3)

  return (
    <>
      <div className="space-y-6">
        {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="Outstanding" value={formatCurrency(metrics.outstanding)} tooltip="Total open invoice amount" />
              <MetricCard title="Overdue" value={formatCurrency(metrics.overdue)} deltaDirection="up" tooltip="Total overdue amount" />
              <MetricCard title="Overdue Ratio" value={`${(metrics.overdueRatio * 100).toFixed(0)}%`} deltaDirection={metrics.overdueRatio > 0.2 ? "up" : "neutral"} tooltip="% of invoices that are overdue" />
              <MetricCard title="Expected Cash-in (Base)" value={formatCurrency(metrics.expectedCashInBase)} tooltip="Expected collections next 2 weeks (base)" />
              <MetricCard title="Expected Cash-in (Pess)" value={formatCurrency(metrics.expectedCashInPess)} tooltip="Expected collections next 2 weeks (pessimistic)" />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Ageing Buckets</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ageingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="bucket" fontSize={12} tick={{ fill: "hsl(var(--foreground))" }} />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} fontSize={12} tick={{ fill: "hsl(var(--foreground))" }} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), "Amount"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} stroke="none" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risky Customers */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Risky Customers</CardTitle>
              </CardHeader>
              <CardContent>
                {riskyCustomers?.length ? (
                  <div className="space-y-3">
                    {riskyCustomers.map((c) => (
                      <Link key={c.customerId} href={`/invoices/customers/${c.customerId}`}>
                        <div className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted">
                          <div>
                            <p className="text-sm font-medium text-foreground">{c.name}</p>
                            <p className="text-xs text-muted-foreground">
                              On-time: {(c.onTimeRate * 100).toFixed(0)}% | Median delay: {c.medianDelayDays}d
                            </p>
                          </div>
                          <span className="text-sm font-medium text-destructive">
                            {formatCurrency(c.exposureOverdueAmount)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No risky customers</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alerts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Invoice Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <AlertList
                alerts={(alerts ?? []).filter((a) => a.type === "overdue_invoice")}
                onClickEvidenceId={setSheetId}
              />
            </CardContent>
          </Card>
      </div>

      <RecordSheet open={!!sheetId} onOpenChange={() => setSheetId(null)} evidenceId={sheetId} />
    </>
  )
}
