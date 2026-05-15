/**
 * UX-only role guards.
 *
 * The backend is the boundary — every mutation is re-checked server-side.
 * These helpers only decide which controls render so the UI doesn't show
 * affordances the user can't actually exercise.
 *
 * Phase 1 will wire the active org's role into a React context; for now
 * call-sites pass the role string explicitly.
 */

export type Role = "owner" | "admin" | "member" | "viewer"

const ORDER: Record<Role, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
}

/**
 * Returns true when `actual` has at least the seniority of `required`.
 *
 * - `hasRole("admin", "member")` → true
 * - `hasRole("viewer", "admin")` → false
 * - `hasRole(undefined, ...)` → false (no role = no access in the UI)
 */
export function hasRole(actual: Role | undefined, required: Role): boolean {
  if (!actual) return false
  return ORDER[actual] >= ORDER[required]
}

export type Action = "edit" | "delete" | "invite" | "billing"

/**
 * Returns true when the role may perform the given action.
 *
 * - edit:    member or higher
 * - delete:  admin or higher
 * - invite:  admin or higher
 * - billing: owner only
 *
 * Backend enforces the same matrix.
 */
export function can(actual: Role | undefined, action: Action): boolean {
  switch (action) {
    case "edit":
      return hasRole(actual, "member")
    case "delete":
      return hasRole(actual, "admin")
    case "invite":
      return hasRole(actual, "admin")
    case "billing":
      return hasRole(actual, "owner")
  }
}
