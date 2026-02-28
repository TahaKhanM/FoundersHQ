"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MetricCard } from "@/components/common/metric-card"
import { PageHeader } from "@/components/common/page-header"
import { RecordSheet } from "@/components/common/record-sheet"
import { useRunwayForecast, useWeeklyForecast, useMilestones } from "@/lib/api/hooks"
import { formatCurrency, formatDate, formatWeeks } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { AlertTriangle, Target, Flag } from "lucide-react"

export default function RunwayPage() {
  const { data: forecast, isLoading } = useRunwayForecast()
  const { data: weekly } = useWeeklyForecast()
  const { data: milestones } = useMilestones()
  const [sheetId, setSheetId] = useState<string | null>(null)

  const chartData = forecast?.series.map((s) => ({
    week: s.weekStart.slice(5),
    base: s.cashBase,
    pessimistic: s.cashPess,
    hasFlag: s.flags.length > 0,
  })) ?? []

  return (
    <>
      <PageHeader title="Runway Radar" description="Cash runway forecasting with scenario analysis" />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : forecast ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard title="Runway (Base)" value={formatWeeks(forecast.cashWeeksBase)} tooltip="Weeks of cash at base spending rate" />
          <MetricCard title="Runway (Pess)" value={formatWeeks(forecast.cashWeeksPess)} deltaDirection={forecast.cashWeeksPess < 12 ? "down" : "neutral"} tooltip="Weeks of cash at pessimistic rate" />
          <MetricCard title="Crash Week (Pess)" value={forecast.crashWeekPess ? formatDate(forecast.crashWeekPess, "MMM d") : "N/A"} deltaDirection={forecast.crashWeekPess ? "down" : "neutral"} tooltip="Week cash hits zero under pessimistic scenario" />
          <MetricCard title="Horizon" value={`${forecast.horizonWeeks} weeks`} tooltip="Forecast horizon" />
        </div>
      ) : null}

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">Forecast Chart</TabsTrigger>
          <TabsTrigger value="table">Weekly Breakdown</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cash Position Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pessGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" fontSize={11} tickLine={false} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [formatCurrency(value), name === "base" ? "Base" : "Pessimistic"]}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="base" stroke="hsl(var(--chart-1))" fill="url(#baseGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="pessimistic" stroke="hsl(var(--chart-3))" fill="url(#pessGrad)" strokeWidth={2} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3 justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-6 rounded-full" style={{ background: "hsl(var(--chart-1))" }} />
                  <span className="text-xs text-muted-foreground">Base</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-6 rounded-full" style={{ background: "hsl(var(--chart-3))", opacity: 0.7 }} />
                  <span className="text-xs text-muted-foreground">Pessimistic</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Week</TableHead>
                      <TableHead>Starting Cash</TableHead>
                      <TableHead>Inflows</TableHead>
                      <TableHead>Outflows</TableHead>
                      <TableHead>Ending Cash</TableHead>
                      <TableHead className="hidden md:table-cell">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekly?.map((row) => (
                      <TableRow
                        key={row.weekStart}
                        className={cn(
                          "cursor-pointer hover:bg-muted/30 transition-colors",
                          row.notes && "bg-warning/5"
                        )}
                        onClick={() => row.evidenceIds.length > 0 && setSheetId(row.evidenceIds[0])}
                      >
                        <TableCell className="font-mono text-xs">{formatDate(row.weekStart, "MMM d")}</TableCell>
                        <TableCell>{formatCurrency(row.startingCash)}</TableCell>
                        <TableCell className="text-success">{formatCurrency(row.inflows)}</TableCell>
                        <TableCell className="text-destructive">{formatCurrency(-row.outflows)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(row.endingCash)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {row.notes && (
                            <span className="flex items-center gap-1 text-xs text-warning-foreground">
                              <AlertTriangle className="h-3 w-3" /> {row.notes}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="mt-4">
          <div className="space-y-3">
            {milestones?.map((ms) => (
              <Card key={ms.milestoneId}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {ms.targetType === "cash" && <Target className="h-4 w-4 text-primary" />}
                    {ms.targetType === "revenue" && <Target className="h-4 w-4 text-success" />}
                    {ms.targetType === "runway" && <Flag className="h-4 w-4 text-warning-foreground" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground">{ms.name}</h3>
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        ms.statusBase === "on_track" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"
                      )}>
                        Base: {ms.statusBase === "on_track" ? "On Track" : "Off Track"}
                      </Badge>
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        ms.statusPess === "on_track" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"
                      )}>
                        Pess: {ms.statusPess === "on_track" ? "On Track" : "Off Track"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Target: {ms.targetType === "cash" ? formatCurrency(ms.targetValue) : ms.targetType === "runway" ? formatWeeks(ms.targetValue) : formatCurrency(ms.targetValue) + "/mo"} by {formatDate(ms.targetWeekStart)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <RecordSheet open={!!sheetId} onOpenChange={() => setSheetId(null)} evidenceId={sheetId} />
    </>
  )
}
