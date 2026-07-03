"use client"

import { Line, LineChart, ResponsiveContainer } from "recharts"

import { cn } from "@/lib/utils"

type Point = { x: number; y: number }

type SparklineProps = {
  data: Point[] | number[]
  width?: number
  height?: number
  trend?: "up" | "down" | "neutral"
  className?: string
}

/**
 * `<Sparkline>` — recharts micro line chart.
 *
 * Renders inline (defaults to 60x18) and animates nothing. Colour follows
 * the `trend` prop and resolves to design-system tokens with a sensible
 * fallback to `currentColor` so the component still works before 0.D
 * lands the palette.
 */
export function Sparkline({
  data,
  width = 60,
  height = 18,
  trend = "neutral",
  className,
}: SparklineProps) {
  const points: Point[] = data.map((d, i) =>
    typeof d === "number" ? { x: i, y: d } : d,
  )
  const color =
    trend === "up"
      ? "var(--accent, currentColor)"
      : trend === "down"
        ? "var(--danger, currentColor)"
        : "var(--ink-3, currentColor)"

  return (
    <span
      className={cn("inline-block align-middle", className)}
      style={{ width, height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line
            type="monotone"
            dataKey="y"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </span>
  )
}
