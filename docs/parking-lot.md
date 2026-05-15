# Parking Lot

Ideas that surfaced during development but are out of current scope. Don't delete; revisit when planning future phases.

Format: one bullet per idea. Use `[YYYY-MM-DD]` prefix.

---

- [2026-05-15] Adopt `next/core-web-vitals` ESLint preset once `eslint-config-next` supports flat-config on ESLint 10. Phase-0 ships a minimal flat config that lints syntax/scope only.
- [2026-05-15] Add `suppressHydrationWarning` to `<html>` in `app/layout.tsx`. The dark-mode `color-scheme` style differs SSR vs client and produces a cosmetic console error. Belongs in phase 1.D polish.
- [2026-05-15] Trim `@radix-ui/react-{menubar,aspect-ratio,accordion}` from `frontend/package.json`. 0.D deleted the consuming shadcn `.tsx` files but left the deps. Verify nothing transitively imports them, then remove.
- [2026-05-15] `s_fund` in `app/services/dashboard/health_score.py` is a documented placeholder capped at 80; a maxed health score is therefore 99. Replace with real funding signal in phase 3.B (Vendor / Funding Intel).
- [2026-05-15] CI matrix: add a job that brings up `postgres:15-alpine` and runs `make test-integration` so `tests/test_api_contracts.py` is exercised on every PR. Currently the existing `backend.yml` workflow runs `pytest -x` with the marker filter inherited from `Makefile`, which would skip integration. Decide whether CI should also gate on integration tests.
- [2026-05-15] Backfill `noqa` audit for the per-file ruff ignores added during 0.A (`app/services/events/sse.py: ASYNC109`, `app/models/*: F821`). Each should be inline noqa with a tight justification once SQLAlchemy 2 forward-ref types are widely understood.
- [2026-05-15] Lighthouse mobile ≥ 90 dashboard target unverified in phase-1 close. Run headless Chrome against `/dashboard` before phase-2 cut and confirm we're at or above the bar.
- [2026-05-15] Playwright per-viewport (320 / 768 / 1440 px) snapshots for every `(shell)` surface. 1.D implemented the responsive structure; we need a deterministic snapshot harness so regressions are caught.
- [2026-05-15] Mount Sonner globally for toast notifications. 1.C's notification-row errors render inline because no toast root exists in the app shell. `docs/DESIGN_SYSTEM.md` already specifies the placement.
- [2026-05-15] Add `Inbox` and `Audit log` items to the side-nav. 1.C's `/inbox` is currently only reachable via the top-bar bell; 1.E's `/settings/audit/` only via direct URL. Belongs in a phase-2 nav polish.
- [2026-05-15] Add `server_default` to the new `orgs.base_currency` and `orgs.fiscal_year_start_month` columns. Currently only ORM-default; raw `INSERT INTO orgs (id, name)` statements (some test fixtures) bypass it. A `server_default` makes raw inserts always safe.
- [2026-05-15] Pull request: enforce worktree isolation for parallel autonomous-build agents. Two of five 1.x agents committed directly to main when their assigned worktree was sparse. Either lock the worktree path or require an explicit `git switch` step in the agent prompt.
- [2026-05-15] Autonomous-build agent prompts should include an explicit "fetch + rebase onto current main as first step" so a stale worktree base doesn't surface as deferred merge conflicts (1.A had to rebase 7 commits over 0.B helpers).
- [2026-05-16] Phase 2.A — Plaid integration. Needs `PLAID_CLIENT_ID` / `PLAID_SECRET` (sandbox free; production per-Item). Implements: backend integration module, link-token + exchange endpoints, daily sync Celery job, dedupe-by-`plaid_txn_id`, "Connect bank" flow under `/integrations` and onboarding, reconnect when item is in error state.
- [2026-05-16] Phase 2.B — QuickBooks + Xero + Stripe. Each needs an OAuth app in the vendor's developer portal. Implements: OAuth flows, mappings to internal invoice/transaction models, reconciliation view at `/integrations/reconcile`.
- [2026-05-16] Phase 2.D — Documents & receipts. Needs Vercel Blob env vars and OpenAI Vision API access. Implements: `documents` + `document_links` tables, upload UI on transaction/invoice RecordSheets, OCR via Vision (guardrails before any extracted field affects state), auto-match by amount + date + merchant similarity.
- [2026-05-16] Insights → RecordSheet drill-down. `<InsightRow>` shows evidence chips but doesn't open a stack of evidence sheets on click. Phase 3.E (Copilot) and 3.B (Vendor Intel) build this pattern; thread it back through `<InsightRow>` once that lands.
- [2026-05-16] FX rate fetcher (Celery task) that pulls ECB or Open Exchange Rates daily and upserts. `upsert_rates` already accepts rows but production has no scheduled producer.
- [2026-05-16] Lint-gate: every new mutation route must have both a `record_audit` call AND a matching `EventType` enum member. Add a CI check.
- [2026-05-16] Document the alembic head-merge pattern (009 collapsed 005/007/008) in the `foundershq-conventions` skill so future parallel agents know how to avoid "multiple heads".
- [2026-05-16] Tag releases at end of every phase (`v0.1.0` for phase 0, etc.). Currently shipping phase changelogs but no git tags; trivial to add and useful for rolling back.
