"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { AlertList } from "@/components/common/alert-list"
import { RecordSheet } from "@/components/common/record-sheet"
import { PageError } from "@/components/dashboard/page-error"
import { MetricCard, Money } from "@/components/finance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils/format"
import {
  useCustomers,
  useInvoiceMetrics,
} from "@/lib/api/queries/invoices"
import { useAlerts } from "@/lib/api/queries/spending"

const TILE_LABELS = [
  "Outstanding",
  "Overdue",
  "Overdue Ratio",
  "Expected Cash-in (Base)",
  "Expected Cash-in (Pess)",
] as const

export default function InvoicesPage() {
  const {
    data: metrics,
    isLoading,
    error,
    mutate,
  } = useInvoiceMetrics()
  const { data: alerts } = useAlerts()
  const { data: customers } = useCustomers()
  const [sheetId, setSheetId] = useState<string | null>(null)

  const ageingData = useMemo(
    () =>
      metrics
        ? [
            { bucket: "0–7d", amount: metrics.ageingBuckets["0-7"] },
            { bucket: "8–30d", amount: metrics.ageingBuckets["8-30"] },
            { bucket: "31–60d", amount: metrics.ageingBuckets["31-60"] },
            { bucket: "60+d", amount: metrics.ageingBuckets["60+"] },
          ]
        : [],
    [metrics],
  )

  const riskyCustomers = useMemo(
    () =>
      (customers ?? [])
        .filter((c) => c.exposureOverdueAmount > 0)
        .sort(
          (a, b) => b.exposureOverdueAmount - a.exposureOverdueAmount,
        )
        .slice(0, 3),
    [customers],
  )

  return (
    <>
      <div className="space-y-6">
        {error ? (
          <PageError
            error={error}
            title="Couldn't load invoice metrics."
            onRetry={() => void mutate()}
          />
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TILE_LABELS.map((label) => (
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
              label="Outstanding"
              value={<Money value={metrics.outstanding} />}
            />
            <MetricCard
              label="Overdue"
              value={<Money value={metrics.overdue} />}
            />
            <MetricCard
              label="Overdue Ratio"
              value={`${(metrics.overdueRatio * 100).toFixed(0)}%`}
              delta={
                metrics.overdueRatio > 0.2
                  ? metrics.overdueRatio * 100 - 20
                  : -((0.2 - metrics.overdueRatio) * 100)
              }
            />
            <MetricCard
              label="Expected (Base)"
              value={<Money value={metrics.expectedCashInBase} />}
            />
            <MetricCard
              label="Expected (Pess)"
              value={<Money value={metrics.expectedCashInPess} />}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Ageing Buckets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={ageingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis
                    dataKey="bucket"
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
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Risky Customers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Top Risky Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {riskyCustomers.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No risky customers right now.
                </p>
              ) : (
                <div className="space-y-3">
                  {riskyCustomers.map((c) => (
                    <Link
                      key={c.customerId}
                      href={`/invoices/customers/${c.customerId}`}
                    >
                      <div className="flex items-center justify-between rounded-lg border border-[color:var(--line)] p-3 transition-colors hover:bg-[color:var(--surface-2)]">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {c.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            On-time: {(c.onTimeRate * 100).toFixed(0)}% · Median
                            delay: {c.medianDelayDays}d
                          </p>
                        </div>
                        <Money value={c.exposureOverdueAmount} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Invoice Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AlertList
              alerts={(alerts ?? []).filter(
                (a) => a.type === "overdue_invoice",
              )}
              onClickEvidenceId={setSheetId}
            />
          </CardContent>
        </Card>
      </div>

      <RecordSheet
        open={!!sheetId}
        onOpenChange={() => setSheetId(null)}
        evidenceId={sheetId}
      />
    </>
  )
}
