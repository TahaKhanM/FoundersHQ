"use client"

import { useState } from "react"
import { ArrowUpRight, Database, FileUp, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DataChoice } from "@/lib/api/queries/onboarding"
import { cn } from "@/lib/utils"

interface StepDataProps {
  onSubmit: (choice: DataChoice) => Promise<void>
  onBack: () => void
}

const CHOICES: {
  id: DataChoice
  title: string
  body: string
  icon: typeof Database
  deepLink?: string
}[] = [
  {
    id: "seed_sample",
    title: "Seed a sample startup",
    body:
      "Ten transactions, three open invoices, two recurring commitments. Lets you click around the whole product.",
    icon: Sparkles,
  },
  {
    id: "import_csv",
    title: "Import a CSV now",
    body:
      "Bring transactions and invoices in via the existing import flow. Comes back here when you’re done.",
    icon: FileUp,
    deepLink: "/spending/transactions",
  },
  {
    id: "start_empty",
    title: "Start with an empty org",
    body:
      "Skip seeding for now. Your dashboard will read “No data yet” until you import.",
    icon: Database,
  },
]

export function StepData({ onSubmit, onBack }: StepDataProps) {
  const [busyChoice, setBusyChoice] = useState<DataChoice | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePick(choice: DataChoice) {
    setBusyChoice(choice)
    setError(null)
    try {
      await onSubmit(choice)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.")
    } finally {
      setBusyChoice(null)
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-2.5">
        {CHOICES.map((opt) => {
          const Icon = opt.icon
          const isBusy = busyChoice === opt.id
          return (
            <button
              type="button"
              key={opt.id}
              onClick={() => handlePick(opt.id)}
              disabled={busyChoice !== null}
              className={cn(
                "group relative flex w-full items-start gap-4 rounded-lg border px-4 py-3.5 text-left transition-all",
                "border-[color:var(--line)] bg-[color:var(--surface)]",
                "hover:border-[color:var(--ink-3)] hover:bg-[color:var(--surface-2)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]",
                busyChoice !== null && !isBusy && "opacity-50",
              )}
            >
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[color:var(--line)] bg-[color:var(--bg)] text-[color:var(--ink-2)]"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-[color:var(--ink)]">
                    {opt.title}
                  </p>
                  {opt.deepLink && (
                    <ArrowUpRight className="h-3.5 w-3.5 text-[color:var(--ink-3)]" />
                  )}
                </div>
                <p className="text-xs text-[color:var(--ink-3)]">{opt.body}</p>
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-[color:var(--danger)]"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={busyChoice !== null}
        >
          Back
        </Button>
      </div>
    </div>
  )
}
