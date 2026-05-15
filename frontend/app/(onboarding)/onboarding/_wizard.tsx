"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { OnboardingProgress } from "@/components/onboarding/progress"
import {
  completeOnboarding,
  seedSampleData,
  submitOnboardingStep,
  useOnboardingMutate,
  useOnboardingState,
  type DataChoice,
  type Persona,
} from "@/lib/api/queries/onboarding"
import { StepOrg } from "./_steps/step-org"
import { StepPersona } from "./_steps/step-persona"
import { StepData } from "./_steps/step-data"
import { StepDone } from "./_steps/step-done"

const STEPS = [
  { label: "Organisation" },
  { label: "Persona" },
  { label: "Data" },
  { label: "Done" },
]

export function OnboardingWizard() {
  const router = useRouter()
  const params = useSearchParams()
  const { data, isLoading } = useOnboardingState()
  const { refresh } = useOnboardingMutate()
  const [finalizing, setFinalizing] = useState(false)

  const overrideStep = params.get("step")
  const activeStep = useMemo(() => {
    if (overrideStep) {
      const n = Number(overrideStep)
      if (n >= 1 && n <= 4) return n
    }
    return data?.step ?? 1
  }, [overrideStep, data?.step])

  const setStep = useCallback(
    (n: number) => {
      const url = new URL(window.location.href)
      url.searchParams.set("step", String(n))
      router.replace(url.pathname + url.search, { scroll: false })
    },
    [router],
  )

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-2.5 w-40 animate-pulse rounded bg-[color:var(--line)]" />
        <div className="h-72 w-full animate-pulse rounded-lg bg-[color:var(--surface)]" />
      </div>
    )
  }

  // Redirect already-onboarded users back to the dashboard.
  if (data.completedAt && !overrideStep) {
    if (typeof window !== "undefined") {
      router.replace("/dashboard")
    }
    return null
  }

  async function handleOrgSubmit(value: {
    orgName: string
    baseCurrency: string
    fiscalYearStartMonth: number
  }) {
    await submitOnboardingStep(1, { step: "org", ...value })
    await refresh()
    setStep(2)
  }

  async function handlePersonaSubmit(persona: Persona) {
    await submitOnboardingStep(2, { step: "persona", persona })
    await refresh()
    setStep(3)
  }

  async function handleDataChoice(choice: DataChoice) {
    if (choice === "seed_sample") {
      await seedSampleData()
    }
    await submitOnboardingStep(3, { step: "data", choice })
    await refresh()
    if (choice === "import_csv") {
      router.push("/spending/transactions")
      return
    }
    setStep(4)
  }

  async function handleGoToDashboard() {
    setFinalizing(true)
    try {
      await completeOnboarding()
      await refresh()
      router.push("/dashboard")
    } finally {
      setFinalizing(false)
    }
  }

  return (
    <section
      aria-label="First-run setup"
      className="space-y-8 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] px-8 py-10 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)]"
    >
      <header className="space-y-5">
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--ink-3)]">
          FoundersHQ · First run
        </p>
        <h1 className="text-2xl font-medium tracking-tight text-[color:var(--ink)]">
          {headerForStep(activeStep)}
        </h1>
        <OnboardingProgress current={activeStep} steps={STEPS} />
      </header>

      <div className="pt-2">
        {activeStep === 1 && (
          <StepOrg
            initial={{
              orgName: data.captured.orgName ?? undefined,
              baseCurrency: data.captured.baseCurrency ?? undefined,
              fiscalYearStartMonth:
                data.captured.fiscalYearStartMonth ?? undefined,
            }}
            onSubmit={handleOrgSubmit}
          />
        )}
        {activeStep === 2 && (
          <StepPersona
            initial={data.captured.persona}
            onSubmit={handlePersonaSubmit}
            onBack={() => setStep(1)}
          />
        )}
        {activeStep === 3 && (
          <StepData onSubmit={handleDataChoice} onBack={() => setStep(2)} />
        )}
        {activeStep === 4 && (
          <StepDone
            orgName={data.captured.orgName}
            onGoToDashboard={handleGoToDashboard}
            finalizing={finalizing}
          />
        )}
      </div>
    </section>
  )
}

function headerForStep(step: number): string {
  switch (step) {
    case 1:
      return "Tell us about your organisation."
    case 2:
      return "Who is using FoundersHQ?"
    case 3:
      return "How would you like to start?"
    case 4:
      return "You’re set up."
    default:
      return "Set up FoundersHQ."
  }
}
