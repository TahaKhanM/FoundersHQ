"use client"

import {
  useIngestRealtime,
  useSpendingRealtime,
} from "@/lib/realtime/domain-hooks"

/**
 * Spending layout: mounts the spending + ingest realtime hooks so the
 * transactions / commitments / rules tabs auto-refresh after a CSV import
 * completes or an in-flight transaction is categorized elsewhere.
 */
export default function SpendingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useSpendingRealtime()
  useIngestRealtime()
  return <>{children}</>
}
