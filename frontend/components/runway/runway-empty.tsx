"use client"

import Link from "next/link"
import { Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Empty state for the Runway page — surfaces a single, concrete CTA
 * that deep-links into the onboarding wizard's "starting cash & recurring
 * inflows" step (step 1).
 */
export function RunwayEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[color:var(--line)] bg-[color:var(--surface)] py-12 px-6 text-center">
      <div className="rounded-full bg-[color:var(--surface-2)] p-3">
        <Wallet className="h-5 w-5 text-[color:var(--accent)]" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        We need cash to chart a runway.
      </h3>
      <p className="max-w-md text-sm text-muted-foreground">
        Set your starting cash and any recurring inflows to render a real
        forecast — the chart and milestones will appear here once that's done.
      </p>
      <Button asChild size="sm" className="mt-2">
        <Link href="/onboarding?step=1">Set starting cash &amp; inflows</Link>
      </Button>
    </div>
  )
}
