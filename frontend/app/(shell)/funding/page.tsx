"use client"

import { useState } from "react"
import { Calendar, ExternalLink } from "lucide-react"

import { PageHeader } from "@/components/common/page-header"
import { RecordSheet } from "@/components/common/record-sheet"
import { PageError } from "@/components/dashboard/page-error"
import { ImprovementChecklist } from "@/components/funding/improvement-checklist"
import { OpportunityTable } from "@/components/funding/opportunity-table"
import { RouteCard } from "@/components/funding/route-card"
import { TableSkeleton } from "@/components/spending/table-skeleton"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useFundingOpportunities,
  useFundingRoutes,
  useFundingTimeline,
  useImprovementChecklist,
} from "@/lib/api/queries/funding"
import { formatDate } from "@/lib/utils/format"

export default function FundingPage() {
  const {
    data: routes,
    isLoading: routesLoading,
    error: routesError,
    mutate: refetchRoutes,
  } = useFundingRoutes()
  const {
    data: opportunities,
    isLoading: oppsLoading,
    error: oppsError,
    mutate: refetchOpps,
  } = useFundingOpportunities()
  const {
    data: timeline,
    isLoading: timelineLoading,
    error: timelineError,
    mutate: refetchTimeline,
  } = useFundingTimeline()
  const {
    data: checklist,
    isLoading: checklistLoading,
    error: checklistError,
    mutate: refetchChecklist,
  } = useImprovementChecklist()
  const [sheetId, setSheetId] = useState<string | null>(null)

  return (
    <>
      <PageHeader
        title="Funding Navigator"
        description="Funding route scoring, opportunities, timeline, and readiness checklist"
      />

      <Tabs defaultValue="routes">
        <TabsList>
          <TabsTrigger value="routes">Funding Routes</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="readiness">Readiness</TabsTrigger>
        </TabsList>

        {/* Routes Tab */}
        <TabsContent value="routes" className="mt-4">
          {routesError ? (
            <PageError
              error={routesError}
              title="Couldn't load funding routes."
              onRetry={() => void refetchRoutes()}
            />
          ) : routesLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-lg" />
              ))}
            </div>
          ) : (routes?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Funding routes will appear once your runway and revenue
                signals are in place.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {routes?.map((route, i) => (
                <RouteCard
                  key={route.routeId}
                  route={route}
                  bestFit={i === 0}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities" className="mt-4">
          {oppsError ? (
            <PageError
              error={oppsError}
              title="Couldn't load opportunities."
              onRetry={() => void refetchOpps()}
            />
          ) : oppsLoading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : (
            <OpportunityTable opportunities={opportunities ?? []} />
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-4">
          {timelineError ? (
            <PageError
              error={timelineError}
              title="Couldn't load the timeline."
              onRetry={() => void refetchTimeline()}
            />
          ) : timelineLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : (timeline?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No recommended steps yet.
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              <div className="absolute bottom-0 left-5 top-0 w-px bg-[color:var(--line)]" />
              <div className="space-y-4">
                {timeline?.map((step) => (
                  <div
                    key={step.stepId}
                    className="relative flex gap-4 pl-12"
                  >
                    <div className="absolute left-3.5 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[color:var(--accent)] ring-4 ring-[color:var(--bg)]" />
                    <Card className="flex-1">
                      <CardContent className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-foreground">
                            {step.title}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            By {formatDate(step.recommendedByDate)}
                          </div>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {step.rationale}
                        </p>
                        {step.relatedOpportunityIds.length > 0 ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {step.relatedOpportunityIds.map((id) => (
                              <Badge
                                key={id}
                                variant="outline"
                                className="text-[10px] font-mono"
                              >
                                <ExternalLink className="mr-1 h-2.5 w-2.5" />
                                {id}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Readiness Tab */}
        <TabsContent value="readiness" className="mt-4">
          {checklistError ? (
            <PageError
              error={checklistError}
              title="Couldn't load the readiness checklist."
              onRetry={() => void refetchChecklist()}
            />
          ) : checklistLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : (
            <ImprovementChecklist
              items={checklist ?? []}
              onOpenEvidence={setSheetId}
            />
          )}
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
