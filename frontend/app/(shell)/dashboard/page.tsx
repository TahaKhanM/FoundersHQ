"use client"

import { useState } from "react"
import Link from "next/link"

import { AlertList } from "@/components/common/alert-list"
import { PageHeader } from "@/components/common/page-header"
import { RecordSheet } from "@/components/common/record-sheet"
import { DashboardEmpty } from "@/components/dashboard/dashboard-empty"
import { HealthScore } from "@/components/dashboard/health-score"
import { PageError } from "@/components/dashboard/page-error"
import { EvidenceChip, MetricCard, Money } from "@/components/finance"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useDashboardAlerts,
  useDashboardMetrics,
} from "@/lib/api/queries/dashboard"
import { ArrowRight, FileText, Landmark, TrendingUp, Wallet } from "lucide-react"

const quickLinks = [
  { label: "Spending Health", href: "/spending", icon: Wallet },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Runway Radar", href: "/runway", icon: TrendingUp },
  { label: "Funding", href: "/funding", icon: Landmark },
]

const METRIC_TILE_COUNT = 6

export default function DashboardPage() {
  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
    mutate: refetchMetrics,
  } = useDashboardMetrics()
  const {
    data: alerts,
    isLoading: alertsLoading,
    error: alertsError,
    mutate: refetchAlerts,
  } = useDashboardAlerts()
  const [sheetId, setSheetId] = useState<string | null>(null)

  const isEmpty =
    !metricsLoading &&
    !metricsError &&
    metrics != null &&
    metrics.totalOutflow30d === 0 &&
    metrics.netBurn30d === 0 &&
    metrics.cashWeeks === 0

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Executive overview of your startup finances"
      />

      {metricsError ? (
        <PageError
          error={metricsError}
          title="Couldn't load your metrics."
          onRetry={() => void refetchMetrics()}
        />
      ) : metricsLoading ? (
        <MetricGridSkeleton />
      ) : isEmpty ? (
        <DashboardEmpty />
      ) : metrics ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <MetricCard
            label="Cash Weeks"
            value={<Money value={metrics.cashWeeks} unit="weeks" />}
          />
          <MetricCard
            label="Net Burn (30d)"
            value={<Money value={metrics.netBurn30d} />}
            delta={
              metrics.spendCreepStatus === "rising"
                ? 5
                : metrics.spendCreepStatus === "declining"
                  ? -5
                  : 0
            }
          />
          <MetricCard
            label="Total Outflow (30d)"
            value={<Money value={-metrics.totalOutflow30d} />}
          />
          <MetricCard
            label="Spend Creep"
            value={
              <span className="capitalize">{metrics.spendCreepStatus}</span>
            }
            delta={
              metrics.spendCreepStatus === "rising"
                ? 8.3
                : metrics.spendCreepStatus === "declining"
                  ? -3.1
                  : 0
            }
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
            className="sm:col-span-2 lg:col-span-1"
            label="Runway (Base / Pess)"
            value={
              <span className="inline-flex items-baseline gap-1.5 tabular-nums">
                <Money value={metrics.runwayBase} unit="weeks" />
                <span className="text-[color:var(--ink-3)] text-base font-normal">
                  /
                </span>
                <Money value={metrics.runwayPess} unit="weeks" />
              </span>
            }
          />
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Alerts */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {alertsError ? (
              <PageError
                error={alertsError}
                title="Couldn't load alerts."
                onRetry={() => void refetchAlerts()}
              />
            ) : alertsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : (
              <AlertList
                alerts={alerts ?? []}
                onClickEvidenceId={setSheetId}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Health Score */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Financial Health</CardTitle>
              {metrics ? (
                <EvidenceChip
                  ids={(alerts ?? []).flatMap((a) => a.evidenceIds).slice(0, 4)}
                  kind="insight"
                  onOpen={(id) => setSheetId(id)}
                />
              ) : null}
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 rounded" />
                  ))}
                </div>
              ) : metrics ? (
                <HealthScore
                  facets={[
                    {
                      label: "Runway",
                      value: clamp(metrics.runwayPess * 4),
                      hint: `${metrics.runwayPess} weeks under pessimistic`,
                    },
                    {
                      label: "Burn Control",
                      value: clamp(
                        100 - Math.min(50, Math.abs(metrics.netBurn30d) / 1000),
                      ),
                      hint:
                        metrics.spendCreepStatus === "rising"
                          ? "Spend is creeping up"
                          : "Spend is contained",
                    },
                    {
                      label: "Collections",
                      value: clamp(100 - metrics.overdueRatio * 100 * 2),
                      hint: `${(metrics.overdueRatio * 100).toFixed(0)}% overdue`,
                    },
                    {
                      label: "Cash Position",
                      value: clamp(metrics.cashWeeks * 5),
                      hint: `${metrics.cashWeeks} weeks of cash`,
                    },
                  ]}
                />
              ) : null}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="flex items-center gap-3 rounded-lg border border-[color:var(--line)] p-3 transition-colors hover:bg-[color:var(--surface-2)]">
                    <link.icon className="h-4 w-4 text-[color:var(--accent)]" />
                    <span className="flex-1 text-sm font-medium text-foreground">
                      {link.label}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled
                >
                  Export weekly actions (Coming soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <RecordSheet
        open={!!sheetId}
        onOpenChange={() => setSheetId(null)}
        evidenceId={sheetId}
      />
    </>
  )
}

function MetricGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: METRIC_TILE_COUNT }).map((_, i) => (
        <div
          key={i}
          className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] p-3"
        >
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="mt-2 h-7 w-28 rounded" />
          <Skeleton className="mt-3 h-3 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}
