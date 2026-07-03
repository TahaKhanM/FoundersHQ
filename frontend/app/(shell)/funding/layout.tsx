"use client"

import { useFundingRealtime } from "@/lib/realtime/domain-hooks"

/**
 * Funding layout: mounts the funding realtime hook so the opportunity
 * timeline + routes-rank widgets refresh when a save-status flips.
 */
export default function FundingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useFundingRealtime()
  return <>{children}</>
}
