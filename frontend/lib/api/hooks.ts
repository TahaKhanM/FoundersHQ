/**
 * Backward-compat shim.
 *
 * Phase 0.C split the per-domain hooks into `lib/api/queries/<domain>.ts`.
 * Existing pages keep importing from `@/lib/api/hooks` until phase-1
 * migrates each consumer to the per-domain modules directly.
 *
 * Add new hooks to `lib/api/queries/<domain>.ts`, NOT here.
 */

export * from "./queries/dashboard"
export * from "./queries/spending"
export * from "./queries/invoices"
export * from "./queries/runway"
export * from "./queries/funding"
export * from "./queries/search"
export * from "./queries/llm"
