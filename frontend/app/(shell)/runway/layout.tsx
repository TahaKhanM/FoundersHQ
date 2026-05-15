"use client"

import { useRunwayRealtime } from "@/lib/realtime/domain-hooks"

/**
 * Runway layout: mounts the runway realtime hook so the forecast chart
 * and milestone list refresh after a recompute or milestone edit.
 */
export default function RunwayLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useRunwayRealtime()
  return <>{children}</>
}
