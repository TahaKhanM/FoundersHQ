"use client"

import Link from "next/link"
import { Sparkles, Plug } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Empty state shown when the dashboard returns no metrics — typically on a
 * brand-new org. Phase 1.D requires every empty state to name concrete CTAs;
 * for the dashboard those are "Connect a bank" (the canonical onboarding
 * path) and "Seed sample data" (the demo path for new accounts).
 */
export function DashboardEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[color:var(--line)] bg-[color:var(--surface)] py-12 px-6 text-center">
      <div className="rounded-full bg-[color:var(--surface-2)] p-3">
        <Sparkles className="h-5 w-5 text-[color:var(--accent)]" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        Nothing to show yet
      </h3>
      <p className="max-w-md text-sm text-muted-foreground">
        Connect a bank or seed sample data to see your runway, burn, and
        invoice metrics light up.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button asChild size="sm">
          <Link href="/integrations">
            <Plug className="mr-1.5 h-3.5 w-3.5" />
            Connect a bank
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/onboarding?step=3">Seed sample data</Link>
        </Button>
      </div>
    </div>
  )
}
