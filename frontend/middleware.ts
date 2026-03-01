/**
 * Phase 1.B: edge middleware.
 *
 * The frontend currently stores its JWT in `localStorage`, which the edge
 * runtime cannot inspect. So the onboarding redirect that runs on every
 * `(shell)/...` route lives in `app/(shell)/layout.tsx` as a client gate
 * (see `OnboardingGate`).
 *
 * This middleware is wired up so that when we move auth to a cookie (or
 * adopt Clerk), the redirect can graduate to the edge layer in one place
 * without restructuring the codebase. Today it only no-ops with a matcher
 * scoped to the routes that should eventually be gated.
 */
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(_req: NextRequest) {
  // No-op for now: client gate handles the redirect because the access token
  // lives in localStorage. See `OnboardingGate` in `app/(shell)/layout.tsx`.
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all `(shell)`-group paths. Excludes Next.js internals, static
     * files, the auth flows, the onboarding wizard itself, and API routes
     * (we don't have any client-API routes today; this is forward-looking).
     */
    "/((?!_next|api|auth|onboarding|favicon.ico|.*\\..*).*)",
  ],
}
