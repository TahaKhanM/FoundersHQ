import { AppShell } from "@/components/layout/app-shell"
import { OnboardingGate } from "@/components/onboarding/gate"

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGate>
      <AppShell>{children}</AppShell>
    </OnboardingGate>
  )
}
