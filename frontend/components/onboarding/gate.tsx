"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { IS_MOCK } from "@/lib/api/client"
import { useOnboardingState } from "@/lib/api/queries/onboarding"

/**
 * Client gate that redirects unauthenticated users into the wizard when
 * onboarding is incomplete.
 *
 * Why this lives client-side: the JWT is stored in localStorage today,
 * which the edge runtime can't reach. When auth moves to a cookie (or
 * Clerk), this logic should graduate into `middleware.ts` and the gate
 * becomes a no-op.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { data, error, isLoading } = useOnboardingState()
  // Allow first paint so the SWR fetch has a chance to resolve before any
  // visible flicker. The check is cheap, so we don't need a global spinner.
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    // Mock mode: never redirect (the mock starts with no progress; we don't
    // want the design playground to bounce to /onboarding).
    if (IS_MOCK) return
    if (isLoading || error || !data) return
    if (data.completedAt) return
    setRedirecting(true)
    router.replace("/onboarding")
  }, [data, error, isLoading, router])

  if (redirecting) {
    return null
  }
  return children
}
