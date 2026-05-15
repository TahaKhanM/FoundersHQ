"use client"

import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface StepDoneProps {
  orgName: string | null
  onGoToDashboard: () => Promise<void>
  finalizing: boolean
}

export function StepDone({ orgName, onGoToDashboard, finalizing }: StepDoneProps) {
  return (
    <div className="grid gap-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--accent)]/12 text-[color:var(--accent)]">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-medium tracking-tight text-[color:var(--ink)]">
          {orgName ? `${orgName} is ready` : "Your workspace is ready"}
        </h2>
        <p className="text-sm text-[color:var(--ink-2)]">
          Every number on the dashboard re-derives from rows you control. Click
          a figure to see its receipts.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-left text-xs text-[color:var(--ink-3)]">
        <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] p-3">
          <p className="font-medium text-[color:var(--ink-2)]">Deterministic</p>
          <p>No LLM-invented figures.</p>
        </div>
        <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] p-3">
          <p className="font-medium text-[color:var(--ink-2)]">Evidence-linked</p>
          <p>Every claim cites its rows.</p>
        </div>
        <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] p-3">
          <p className="font-medium text-[color:var(--ink-2)]">Audit-logged</p>
          <p>Every mutation persisted.</p>
        </div>
      </div>
      <div className="flex justify-center pt-1">
        <Button onClick={onGoToDashboard} disabled={finalizing}>
          {finalizing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Go to dashboard
        </Button>
      </div>
    </div>
  )
}
