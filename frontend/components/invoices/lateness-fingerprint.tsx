"use client"

import type { CustomerDTO } from "@/lib/api/types"

interface LatenessFingerprintProps {
  customer: CustomerDTO
}

/**
 * Small "lateness fingerprint" — a stylized bar showing where this
 * customer typically lands on the on-time / median-delay / p90-delay
 * spectrum. Used on the customer detail page.
 *
 * Colour bands follow the same accent / warn / danger token set used
 * across the other 1.D surfaces.
 */
export function LatenessFingerprint({ customer }: LatenessFingerprintProps) {
  const onTimePct = Math.max(0, Math.min(100, customer.onTimeRate * 100))
  // Pin median + p90 to a 60-day axis so the proportional bars stay readable.
  const axis = 60
  const medianPct = Math.min(100, (customer.medianDelayDays / axis) * 100)
  const p90Pct = Math.min(100, (customer.p90DelayDays / axis) * 100)

  return (
    <div className="space-y-3">
      <Row
        label="On-time"
        valueLabel={`${onTimePct.toFixed(0)}%`}
        pct={onTimePct}
        color="var(--accent)"
      />
      <Row
        label="Median delay"
        valueLabel={`${customer.medianDelayDays}d`}
        pct={medianPct}
        color={medianPct < 33 ? "var(--accent)" : medianPct < 66 ? "var(--warn)" : "var(--danger)"}
      />
      <Row
        label="P90 delay"
        valueLabel={`${customer.p90DelayDays}d`}
        pct={p90Pct}
        color={p90Pct < 33 ? "var(--accent)" : p90Pct < 66 ? "var(--warn)" : "var(--danger)"}
      />
      <p className="pt-1 text-[11px] text-muted-foreground">
        Axis pinned to 60 days. Bars show where this customer typically lands.
      </p>
    </div>
  )
}

function Row({
  label,
  valueLabel,
  pct,
  color,
}: {
  label: string
  valueLabel: string
  pct: number
  color: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">{valueLabel}</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-2)]"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}
