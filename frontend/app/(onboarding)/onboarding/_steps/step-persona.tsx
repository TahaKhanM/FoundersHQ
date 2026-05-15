"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Persona } from "@/lib/api/queries/onboarding"
import { cn } from "@/lib/utils"

interface StepPersonaProps {
  initial?: Persona | null
  onSubmit: (persona: Persona) => Promise<void>
  onBack: () => void
}

const PERSONA_OPTIONS: { id: Persona; title: string; hint: string }[] = [
  {
    id: "founder_operator",
    title: "Founder running operations",
    hint: "I’m the CEO and I touch the bank statements.",
  },
  {
    id: "first_time_founder",
    title: "First-time founder",
    hint: "I’ve never read a cash-flow statement in anger before.",
  },
  {
    id: "second_time_founder",
    title: "Second-time (or more) founder",
    hint: "I know what a runway model looks like; just give me the keys.",
  },
  {
    id: "ops_finance_lead",
    title: "Ops or finance lead",
    hint: "I’m the person the founder will forward this email to.",
  },
]

export function StepPersona({ initial, onSubmit, onBack }: StepPersonaProps) {
  const [selected, setSelected] = useState<Persona | null>(initial ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      await onSubmit(selected)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div
        role="radiogroup"
        aria-label="What brings you here?"
        className="grid gap-2.5"
      >
        {PERSONA_OPTIONS.map((opt) => {
          const isActive = selected === opt.id
          return (
            <button
              type="button"
              role="radio"
              aria-checked={isActive}
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              className={cn(
                "group relative w-full rounded-lg border px-4 py-3 text-left transition-all",
                "border-[color:var(--line)] hover:border-[color:var(--ink-3)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]",
                isActive
                  ? "border-[color:var(--accent)] bg-[color:var(--accent)]/8 shadow-[0_0_0_1px_color-mix(in_oklch,var(--accent)_30%,transparent)]"
                  : "bg-[color:var(--surface)]",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isActive ? "text-[color:var(--ink)]" : "text-[color:var(--ink)]",
                    )}
                  >
                    {opt.title}
                  </p>
                  <p className="text-xs text-[color:var(--ink-3)]">{opt.hint}</p>
                </div>
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                    isActive
                      ? "border-[color:var(--accent)] bg-[color:var(--accent)]"
                      : "border-[color:var(--line)]",
                  )}
                >
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent-ink,var(--bg))]" />
                  )}
                </span>
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
        <Button type="button" variant="ghost" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button type="submit" disabled={!selected || loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </div>
    </form>
  )
}
