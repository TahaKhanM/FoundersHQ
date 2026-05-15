"use client"

import { useMemo } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts"

import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { RunwayForecastDTO } from "@/lib/api/types"

interface ForecastChartProps {
  forecast: RunwayForecastDTO
  /** Called with the evidence id when a user clicks the "N sources" link
   * inside the tooltip. */
  onOpenEvidence?: (id: string) => void
}

interface ChartDatum {
  week: string
  weekStart: string
  base: number
  pessimistic: number
  evidenceIds: string[]
  flags: string[]
}

/**
 * Runway forecast area chart.
 *
 * - Uses `var(--accent)` for base and `var(--danger)` for pessimistic.
 * - Custom tooltip surfaces `N sources` from the evidence ids attached to
 *   the underlying weekly point, deep-linking into the RecordSheet stack
 *   when the user clicks it.
 */
export function ForecastChart({ forecast, onOpenEvidence }: ForecastChartProps) {
  const data = useMemo<ChartDatum[]>(
    () =>
      forecast.series.map((s) => ({
        week: s.weekStart.slice(5),
        weekStart: s.weekStart,
        base: s.cashBase,
        pessimistic: s.cashPess,
        evidenceIds: s.evidenceIds,
        flags: s.flags,
      })),
    [forecast.series],
  )

  return (
    <div>
      <ResponsiveContainer width="100%" height={360}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="runway-base-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="runway-pess-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.18} />
              <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis
            dataKey="week"
            fontSize={11}
            tickLine={false}
            tick={{ fill: "var(--ink-3)" }}
            stroke="var(--line)"
          />
          <YAxis
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            fontSize={11}
            tickLine={false}
            tick={{ fill: "var(--ink-3)" }}
            stroke="var(--line)"
          />
          <Tooltip
            content={(props) => (
              <ForecastTooltip
                {...(props as TooltipProps<number, string>)}
                onOpenEvidence={onOpenEvidence}
              />
            )}
            cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }}
          />
          <ReferenceLine
            y={0}
            stroke="var(--danger)"
            strokeDasharray="4 4"
          />
          <Area
            type="monotone"
            dataKey="base"
            stroke="var(--accent)"
            fill="url(#runway-base-grad)"
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="pessimistic"
            stroke="var(--danger)"
            fill="url(#runway-pess-grad)"
            strokeWidth={2}
            strokeDasharray="4 4"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-6 rounded-full"
            style={{ background: "var(--accent)" }}
          />
          Base
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-6 rounded-full"
            style={{ background: "var(--danger)" }}
          />
          Pessimistic
        </span>
      </div>
    </div>
  )
}

function ForecastTooltip({
  active,
  payload,
  onOpenEvidence,
}: TooltipProps<number, string> & {
  onOpenEvidence?: (id: string) => void
}) {
  if (!active || !payload || payload.length === 0) return null
  const datum = (payload[0]?.payload ?? {}) as ChartDatum
  const evidenceCount = datum.evidenceIds?.length ?? 0
  const firstId = datum.evidenceIds?.[0]

  return (
    <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] p-3 text-xs shadow-lg">
      <p className="font-mono text-[11px] text-[color:var(--ink-3)]">
        {formatDate(datum.weekStart, "MMM d, yyyy")}
      </p>
      <div className="mt-2 space-y-1 tabular-nums">
        <Row label="Base" value={formatCurrency(datum.base)} color="var(--accent)" />
        <Row
          label="Pessimistic"
          value={formatCurrency(datum.pessimistic)}
          color="var(--danger)"
        />
      </div>
      {evidenceCount > 0 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (firstId && onOpenEvidence) onOpenEvidence(firstId)
          }}
          className="mt-2 inline-flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--surface-2)] px-2 py-0.5 text-[11px] text-[color:var(--ink-2)] hover:bg-[color:var(--accent)]/10 hover:text-[color:var(--accent)]"
        >
          {evidenceCount} source{evidenceCount > 1 ? "s" : ""}
        </button>
      ) : null}
      {datum.flags?.length ? (
        <p className="mt-2 text-[11px] text-[color:var(--warn)]">
          {datum.flags.join(" · ")}
        </p>
      ) : null}
    </div>
  )
}

function Row({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
        />
        <span className="text-muted-foreground">{label}</span>
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
