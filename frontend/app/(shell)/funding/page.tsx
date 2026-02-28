"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { PageHeader } from "@/components/common/page-header"
import {
  useFundingRoutes,
  useFundingOpportunities,
  useFundingTimeline,
  useImprovementChecklist,
} from "@/lib/api/hooks"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import {
  Zap,
  Shield,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Calendar,
  ArrowRight,
  Target,
} from "lucide-react"

const breakdownLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  eligibility: { label: "Eligibility", icon: <CheckCircle2 className="h-3 w-3" /> },
  speed: { label: "Speed", icon: <Zap className="h-3 w-3" /> },
  costRisk: { label: "Cost/Risk", icon: <DollarSign className="h-3 w-3" /> },
  control: { label: "Control", icon: <Shield className="h-3 w-3" /> },
  riskCompatibility: { label: "Compatibility", icon: <Target className="h-3 w-3" /> },
}

export default function FundingPage() {
  const { data: routes, isLoading: routesLoading } = useFundingRoutes()
  const { data: opportunities } = useFundingOpportunities()
  const { data: timeline } = useFundingTimeline()
  const { data: checklist } = useImprovementChecklist()
  const [doneItems, setDoneItems] = useState<Set<string>>(new Set())

  function toggleItem(id: string) {
    setDoneItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const checklistDone = checklist?.filter((c) => c.done || doneItems.has(c.itemId)).length ?? 0
  const checklistTotal = checklist?.length ?? 0

  return (
    <>
      <PageHeader title="Funding Navigator" description="Funding route scoring, opportunities, timeline, and readiness checklist" />

      <Tabs defaultValue="routes">
        <TabsList>
          <TabsTrigger value="routes">Funding Routes</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="readiness">Readiness</TabsTrigger>
        </TabsList>

        {/* Routes Tab */}
        <TabsContent value="routes" className="mt-4">
          {routesLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {routes?.map((route, i) => (
                <Card key={route.routeId} className={cn(i === 0 && "border-primary/30 shadow-sm")}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          {i === 0 && <Badge className="bg-primary text-primary-foreground text-xs">Best Fit</Badge>}
                          <h3 className="text-base font-semibold text-foreground">{route.name}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-foreground">{route.fitScore}</span>
                        <span className="text-sm text-muted-foreground">/100</span>
                      </div>
                    </div>

                    {/* Breakdown bars */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4 sm:grid-cols-5">
                      {Object.entries(route.breakdown).map(([key, val]) => {
                        const info = breakdownLabels[key]
                        return (
                          <div key={key}>
                            <div className="flex items-center gap-1 mb-1">
                              {info?.icon}
                              <span className="text-xs text-muted-foreground">{info?.label ?? key}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={val} className="h-1.5 flex-1" />
                              <span className="text-xs font-medium text-foreground w-6 text-right">{val}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Why bullets */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Why this fits</p>
                        <ul className="space-y-1">
                          {route.whyBullets.map((b, j) => (
                            <li key={j} className="flex items-start gap-1.5 text-xs text-foreground">
                              <CheckCircle2 className="h-3 w-3 text-success mt-0.5 shrink-0" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {route.warnings.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">Warnings</p>
                          <ul className="space-y-1">
                            {route.warnings.map((w, j) => (
                              <li key={j} className="flex items-start gap-1.5 text-xs text-foreground">
                                <AlertTriangle className="h-3 w-3 text-warning-foreground mt-0.5 shrink-0" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Requirements */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Requirements</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {route.requirements.map((r, j) => (
                          <Badge key={j} variant="outline" className="text-xs">{r}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {opportunities?.map((opp) => (
              <Card key={opp.opportunityId} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{opp.name}</h3>
                      <p className="text-xs text-muted-foreground">{opp.provider} - {opp.type.replace(/_/g, " ")}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{opp.geography}</Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    {formatCurrency(opp.amountMin)} - {formatCurrency(opp.amountMax)}
                  </p>
                  {opp.deadline && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <Clock className="h-3 w-3" />
                      Deadline: {formatDate(opp.deadline)}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {opp.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Confidence: {(opp.parseConfidence * 100).toFixed(0)}%
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      Details <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-4">
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-4">
              {timeline?.map((step, i) => (
                <div key={step.stepId} className="relative flex gap-4 pl-12">
                  <div className="absolute left-3.5 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary ring-4 ring-background" />
                  <Card className="flex-1">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          By {formatDate(step.recommendedByDate)}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.rationale}</p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Readiness Tab */}
        <TabsContent value="readiness" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Funding Readiness Score</CardTitle>
                <span className="text-sm font-semibold text-foreground">
                  {checklistDone}/{checklistTotal}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0} className="h-2" />
            </CardContent>
          </Card>

          <div className="space-y-2">
            {checklist?.map((item) => {
              const isDone = item.done || doneItems.has(item.itemId)
              return (
                <Card key={item.itemId} className={cn(isDone && "opacity-60")}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <Checkbox
                      checked={isDone}
                      onCheckedChange={() => toggleItem(item.itemId)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-medium text-foreground", isDone && "line-through")}>{item.title}</p>
                        <Badge variant="outline" className="text-xs capitalize">{item.linkedModule}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}
