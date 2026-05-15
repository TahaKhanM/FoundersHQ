import { Suspense } from "react"
import { OnboardingWizard } from "./_wizard"

/**
 * Phase 1.B: wizard container.
 *
 * The wizard itself reads the active step from `?step=` via `useSearchParams`,
 * which forces this page into a client-rendered island. We wrap it in
 * Suspense so the App-Router prerender doesn't bail out.
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={<WizardSkeleton />}>
      <OnboardingWizard />
    </Suspense>
  )
}

function WizardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-2.5 w-40 animate-pulse rounded bg-[color:var(--line)]" />
      <div className="h-72 w-full animate-pulse rounded-lg bg-[color:var(--surface)]" />
    </div>
  )
}
