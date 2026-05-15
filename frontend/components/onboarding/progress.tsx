"use client"

import { cn } from "@/lib/utils"

interface OnboardingProgressProps {
  current: number
  steps: { label: string }[]
  className?: string
}

/**
 * Step pip indicator for the onboarding wizard.
 *
 * Renders one pip per step. The active pip is filled with the accent token;
 * completed pips show a thin ring; upcoming pips are muted. Designed to be
 * read at a glance without competing with the form below it.
 */
export function OnboardingProgress({
  current,
  steps,
  className,
}: OnboardingProgressProps) {
  return (
    <ol
      className={cn(
        "flex items-center justify-center gap-3 text-[0.8125rem] text-[color:var(--ink-3)]",
        className,
      )}
      aria-label="Onboarding progress"
    >
      {steps.map((step, idx) => {
        const stepNumber = idx + 1
        const state =
          stepNumber < current
            ? "complete"
            : stepNumber === current
              ? "active"
              : "upcoming"
        return (
          <li key={step.label} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-current={state === "active" ? "step" : undefined}
                className={cn(
                  "inline-flex h-2 w-2 rounded-full transition-colors",
                  state === "complete" && "bg-[color:var(--accent)]",
                  state === "active" &&
                    "bg-[color:var(--accent)] ring-2 ring-[color:var(--accent)]/30 ring-offset-2 ring-offset-[color:var(--bg)]",
                  state === "upcoming" && "bg-[color:var(--line)]",
                )}
              />
              <span
                className={cn(
                  "uppercase tracking-[0.14em] text-[0.7rem]",
                  state === "active" && "text-[color:var(--ink)] font-medium",
                  state === "complete" && "text-[color:var(--ink-2)]",
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px w-8 transition-colors",
                  state === "complete"
                    ? "bg-[color:var(--accent)]/60"
                    : "bg-[color:var(--line)]",
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
