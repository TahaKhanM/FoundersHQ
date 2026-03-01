"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts"

interface ExpenseSlice {
  name: string
  amount: number
  pct: number
  bucketKey: string
}

interface ExpenseMixDonutProps {
  periodLabel: string
  centerLabel: string
  centerValue: string
  slices: ExpenseSlice[]
  onSliceClick?: (bucketKey: string) => void
  className?: string
}

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-muted-foreground)",
]

export function ExpenseMixDonut({
  periodLabel,
  centerLabel,
  centerValue,
  slices,
  onSliceClick,
  className,
}: ExpenseMixDonutProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {}
    slices.forEach((slice, index) => {
      config[slice.bucketKey] = {
        label: slice.name,
        color: COLORS[index % COLORS.length],
      }
    })
    return config
  }, [slices])

  const data = slices.map((slice, index) => ({
    ...slice,
    fill: COLORS[index % COLORS.length],
  }))

  const handlePieEnter = (_: unknown, index: number) => {
    setActiveIndex(index)
  }

  const handlePieLeave = () => {
    setActiveIndex(null)
  }

  const handleClick = (data: { bucketKey: string }) => {
    onSliceClick?.(data.bucketKey)
  }

  const renderActiveShape = (props: {
    cx: number
    cy: number
    innerRadius: number
    outerRadius: number
    startAngle: number
    endAngle: number
    fill: string
  }) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          style={{ cursor: "pointer", outline: "none" }}
        />
      </g>
    )
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Expense Mix</CardTitle>
        <p className="text-sm text-muted-foreground">{periodLabel}</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-square max-h-[280px] mx-auto">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => (
                      <div className="flex items-center justify-between gap-4">
                        <span>{item.payload.name}</span>
                        <span className="font-mono font-medium">
                          {formatCurrency(value as number)} ({item.payload.pct.toFixed(1)}%)
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={2}
                dataKey="amount"
                nameKey="name"
                onMouseEnter={handlePieEnter}
                onMouseLeave={handlePieLeave}
                onClick={handleClick}
                activeIndex={activeIndex !== null ? activeIndex : undefined}
                activeShape={renderActiveShape as never}
                style={{ cursor: "pointer", outline: "none" }}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.bucketKey}`}
                    fill={entry.fill}
                    stroke="transparent"
                    tabIndex={0}
                    aria-label={`${entry.name}: ${formatCurrency(entry.amount)} (${entry.pct.toFixed(1)}%)`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onSliceClick?.(entry.bucketKey)
                      }
                    }}
                    style={{ outline: "none" }}
                  />
                ))}
              </Pie>
              {/* Center text */}
              <text
                x="50%"
                y="47%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground text-xs"
              >
                {centerLabel}
              </text>
              <text
                x="50%"
                y="55%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-lg font-bold"
              >
                {centerValue}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Legend */}
        <div className="mt-4 grid grid-cols-2 gap-2" role="list" aria-label="Expense categories">
          {slices.map((slice, index) => (
            <button
              key={slice.bucketKey}
              onClick={() => onSliceClick?.(slice.bucketKey)}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md text-left transition-colors",
                "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              role="listitem"
            >
              <div
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{slice.name}</p>
                <p className="text-xs text-muted-foreground">
                  {slice.pct.toFixed(1)}%
                </p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
