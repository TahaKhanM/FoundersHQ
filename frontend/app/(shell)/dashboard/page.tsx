"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MetricCard } from "@/components/common/metric-card"
import { AlertList } from "@/components/common/alert-list"
import { RecordSheet } from "@/components/common/record-sheet"
import { PageHeader } from "@/components/common/page-header"
import { useDashboardMetrics, useDashboardAlerts } from "@/lib/api/hooks"
import { formatCurrency, formatWeeks } from "@/lib/utils/format"
import { ArrowRight, Wallet, FileText, TrendingUp, Landmark } from "lucide-react"

const quickLinks = [
  { label: "Spending Health", href: "/spending", icon: Wallet, color: "text-chart-1" },
  { label: "Invoices", href: "/invoices", icon: FileText, color: "text-chart-2" },
  { label: "Runway Radar", href: "/runway", icon: TrendingUp, color: "text-chart-3" },
  { label: "Funding", href: "/funding", icon: Landmark, color: "text-chart-4" },
]

export default function DashboardPage() {
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics()
  const { data: alerts, isLoading: alertsLoading } = useDashboardAlerts()
  const [sheetId, setSheetId] = useState<string | null>(null)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Executive overview of your startup finances"
      />

      {/* Metric Cards */}
      {metricsLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <MetricCard
            title="Cash Weeks"
            value={`${metrics.cashWeeks}`}
            tooltip="Weeks of cash remaining at current burn rate"
          />
          <MetricCard
            title="Net Burn (30d)"
            value={formatCurrency(metrics.netBurn30d)}
            deltaDirection="down"
            delta="burn"
            tooltip="Net cash outflow over the last 30 days"
          />
          <MetricCard
            title="Total Outflow (30d)"
            value={formatCurrency(metrics.totalOutflow30d)}
            tooltip="Total spending over the last 30 days"
          />
          <MetricCard
            title="Spend Creep"
            value={metrics.spendCreepStatus}
            deltaDirection={metrics.spendCreepStatus === "rising" ? "up" : metrics.spendCreepStatus === "declining" ? "down" : "neutral"}
            delta={metrics.spendCreepStatus}
            tooltip="Month-over-month spending trend"
          />
          <MetricCard
            title="Overdue Ratio"
            value={`${(metrics.overdueRatio * 100).toFixed(0)}%`}
            deltaDirection={metrics.overdueRatio > 0.2 ? "up" : "neutral"}
            tooltip="Proportion of invoices that are overdue"
          />
          <MetricCard
            title="Runway (Base / Pess)"
            value={`${formatWeeks(metrics.runwayBase)} / ${formatWeeks(metrics.runwayPess)}`}
            deltaDirection={metrics.runwayPess < 12 ? "down" : "neutral"}
            tooltip="Estimated weeks until cash runs out"
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
            {alertsLoading ? (
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

        {/* Quick Links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted">
                  <link.icon className={`h-4 w-4 ${link.color}`} />
                  <span className="text-sm font-medium text-foreground flex-1">
                    {link.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}

            <div className="pt-2">
              <Button variant="outline" size="sm" className="w-full" disabled>
                Export weekly actions (Coming soon)
              </Button>
            </div>
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
