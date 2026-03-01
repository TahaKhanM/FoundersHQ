"use client"

import { useSpendingRealtime } from "@/lib/realtime/domain-hooks"

/**
 * Dashboard layout: passthrough wrapper that mounts the spending realtime
 * hook. The dashboard's headline cards read through ``dashboard-metrics``
 * + ``dashboard-alerts`` SWR keys; the hook invalidates both on new
 * transactions / categorization changes / etc.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useSpendingRealtime()
  return <>{children}</>
}
