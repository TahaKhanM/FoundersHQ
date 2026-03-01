"use client"

import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Shield,
  Target,
  Zap,
} from "lucide-react"

import { MetricCard } from "@/components/finance"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FundingRouteDTO } from "@/lib/api/types"

interface RouteCardProps {
  route: FundingRouteDTO
  bestFit?: boolean
}

const facetMeta: Record<
  keyof FundingRouteDTO["breakdown"],
  { label: string; icon: React.ReactNode }
> = {
  eligibility: { label: "Eligibility", icon: <CheckCircle2 className="h-3 w-3" /> },
  speed: { label: "Speed", icon: <Zap className="h-3 w-3" /> },
  costRisk: { label: "Cost/Risk", icon: <DollarSign className="h-3 w-3" /> },
  control: { label: "Control", icon: <Shield className="h-3 w-3" /> },
  riskCompatibility: {
    label: "Compatibility",
    icon: <Target className="h-3 w-3" />,
  },
}

/**
 * A funding route surfaces its fit score as a hero-density `<MetricCard>`,
 * then a breakdown grid + "why this fits / warnings / requirements" panel
 * underneath. Breakdown bars colour-shift on the same accent / warn /
 * danger thresholds used everywhere else in 1.D.
 */
export function RouteCard({ route, bestFit = false }: RouteCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5",
        bestFit && "border-[color:var(--accent)]/40 shadow-sm",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          {bestFit ? (
            <Badge className="bg-[color:var(--accent)] text-[color:var(--accent-ink)] text-[10px]">
              Best fit
            </Badge>
          ) : null}
          <h3 className="text-base font-semibold text-foreground">
            {route.name}
          </h3>
        </div>
        <MetricCard
          density="expanded"
          label="Fit score"
          value={
            <span className="inline-flex items-baseline gap-1 tabular-nums">
              {route.fitScore}
              <span className="text-base font-normal text-[color:var(--ink-3)]">
                /100
              </span>
            </span>
          }
          className="min-w-[160px] !p-3"
        />
      </div>

      <div className="mt-4 space-y-4">
        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
          {Object.entries(route.breakdown).map(([key, val]) => {
            const meta = facetMeta[key as keyof FundingRouteDTO["breakdown"]]
            const color =
              val >= 80
                ? "var(--accent)"
                : val >= 60
                  ? "var(--warn)"
                  : "var(--danger)"
            return (
              <div key={key}>
                <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {meta?.icon}
                  {meta?.label ?? key}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${val}%`, background: color }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-medium tabular-nums text-foreground">
                    {val}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Why & warnings */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Why this fits
            </p>
            <ul className="space-y-1">
              {route.whyBullets.map((b, j) => (
                <li
                  key={j}
                  className="flex items-start gap-1.5 text-xs text-foreground"
                >
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--accent)]" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          {route.warnings.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Warnings
              </p>
              <ul className="space-y-1">
                {route.warnings.map((w, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-1.5 text-xs text-foreground"
                  >
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--warn)]" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Requirements */}
        <div className="border-t border-[color:var(--line)] pt-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Requirements
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {route.requirements.map((r, j) => (
              <Badge key={j} variant="outline" className="text-xs">
                {r}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
