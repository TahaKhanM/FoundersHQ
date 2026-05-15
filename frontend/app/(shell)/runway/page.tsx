"use client"

import { useMemo, useState } from "react"

import { PageHeader } from "@/components/common/page-header"
import { RecordSheet } from "@/components/common/record-sheet"
import { PageError } from "@/components/dashboard/page-error"
import { DeltaBadge, MetricCard, Money } from "@/components/finance"
import { ForecastChart } from "@/components/runway/forecast-chart"
import { MilestoneEdit } from "@/components/runway/milestone-edit"
import { RunwayEmpty } from "@/components/runway/runway-empty"
import { WeeklyTable } from "@/components/runway/weekly-table"
import { TableSkeleton } from "@/components/spending/table-skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useMilestones,
  useRunwayForecast,
  useWeeklyForecast,
} from "@/lib/api/queries/runway"
import { formatDate } from "@/lib/utils/format"

const HERO_LABELS = [
  "Runway (Base)",
  "Runway (Pess)",
  "Crash Week (Pess)",
  "Horizon",
] as const

export default function RunwayPage() {
  const {
    data: forecast,
    isLoading,
    error,
    mutate,
  } = useRunwayForecast()
  const {
    data: weekly,
    isLoading: weeklyLoading,
    error: weeklyError,
    mutate: refetchWeekly,
  } = useWeeklyForecast()
  const {
    data: milestones,
    isLoading: milestonesLoading,
    error: milestonesError,
  } = useMilestones()
  const [sheetId, setSheetId] = useState<string | null>(null)

  // Delta between base and pessimistic runway weeks — surfaced as a
  // <DeltaBadge> next to the Crash Week (Pess) tile.
  const runwayDelta = useMemo(() => {
    if (!forecast) return 0
    return forecast.cashWeeksPess - forecast.cashWeeksBase
  }, [forecast])

  const isEmpty =
    !!forecast &&
    forecast.cashWeeksBase === 0 &&
    forecast.cashWeeksPess === 0 &&
    forecast.series.length === 0

  return (
    <>
      <PageHeader
        title="Runway Radar"
        description="Cash runway forecasting with scenario analysis"
      />

      {error ? (
        <PageError
          error={error}
          title="Couldn't load your runway forecast."
          onRetry={() => void mutate()}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HERO_LABELS.map((label) => (
            <div
              key={label}
              className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] p-3"
            >
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="mt-2 h-7 w-28 rounded" />
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <RunwayEmpty />
      ) : forecast ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Runway (Base)"
            value={<Money value={forecast.cashWeeksBase} unit="weeks" />}
          />
          <MetricCard
            label="Runway (Pess)"
            value={<Money value={forecast.cashWeeksPess} unit="weeks" />}
          />
          <MetricCard
            label="Crash Week (Pess)"
            value={
              forecast.crashWeekPess
                ? formatDate(forecast.crashWeekPess, "MMM d")
                : "—"
            }
            // Pess runway weeks - base runway weeks. Negative = pess crashes earlier.
            delta={runwayDelta}
          />
          <MetricCard
            label="Horizon"
            value={<Money value={forecast.horizonWeeks} unit="weeks" />}
          />
        </div>
      ) : null}

      {/* Inline crash-week summary — calls out the DeltaBadge directly so the
          gap between base and pessimistic is one glance away. */}
      {!isEmpty && forecast?.crashWeekBase ? (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Crash week — base: </span>
              <span className="font-medium text-foreground">
                {formatDate(forecast.crashWeekBase, "MMM d")}
              </span>
              <span className="mx-2 text-muted-foreground">vs pess:</span>
              <span className="font-medium text-foreground">
                {forecast.crashWeekPess
                  ? formatDate(forecast.crashWeekPess, "MMM d")
                  : "—"}
              </span>
            </div>
            <DeltaBadge value={runwayDelta} format="absolute" />
          </CardContent>
        </Card>
      ) : null}

      {!isEmpty ? (
        <Tabs defaultValue="chart">
          <TabsList>
            <TabsTrigger value="chart">Forecast Chart</TabsTrigger>
            <TabsTrigger value="table">Weekly Breakdown</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Cash Position Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                {forecast ? (
                  <ForecastChart
                    forecast={forecast}
                    onOpenEvidence={setSheetId}
                  />
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="table" className="mt-4">
            {weeklyError ? (
              <PageError
                error={weeklyError}
                title="Couldn't load the weekly breakdown."
                onRetry={() => void refetchWeekly()}
              />
            ) : weeklyLoading ? (
              <TableSkeleton rows={8} columns={7} />
            ) : (
              <WeeklyTable
                weekly={weekly ?? []}
                onOpenEvidence={setSheetId}
              />
            )}
          </TabsContent>

          <TabsContent value="milestones" className="mt-4">
            {milestonesError ? (
              <PageError
                error={milestonesError}
                title="Couldn't load milestones."
              />
            ) : milestonesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : (milestones?.length ?? 0) === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No milestones yet. Add a milestone from the scenario panel
                  once it lands in phase 3.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {milestones?.map((ms) => (
                  <MilestoneEdit key={ms.milestoneId} milestone={ms} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : null}

      <RecordSheet
        open={!!sheetId}
        onOpenChange={() => setSheetId(null)}
        evidenceId={sheetId}
      />
    </>
  )
}
