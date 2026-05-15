# Phase 1 — Finish the MVP, properly

**Completed:** 2026-05-15

Every existing surface is now polished, role-gated, and audit-logged; a new user can sign up, onboard with sample data, navigate every section, and reach every record. The auth surface is complete (RBAC, invitations, password reset), the notifications inbox is live with SSE-driven updates, and the audit log has a queryable UI.

## What shipped

### 1.A — Auth & Team (RBAC, invitations, password reset)
- `requires_role(*roles)` FastAPI dependency — server-side RBAC; backend is the boundary.
- `Invitation` + `PasswordResetToken` models + alembic migration `006`. Tokens stored as sha256 hash only; raw tokens returned in non-prod for end-to-end testing.
- New endpoints: `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/accept-invite`; `GET/POST /org/invitations`, `DELETE /org/invitations/{id}`; `GET /org/members`, `PATCH /org/members/{id}`, `DELETE /org/members/{id}`.
- Cannot remove the last owner — server-side invariant.
- Frontend: `/(shell)/team/page.tsx` with inline role select + remove + pending-invites table + invite form; `/(auth)/{forgot-password,reset-password,accept-invite}/page.tsx`.

### 1.B — Onboarding wizard
- 6 new columns on `orgs`: `base_currency`, `fiscal_year_start_month`, `industry`, `stage`, `persona`, `onboarding_completed_at`. Migration `007`.
- Pure-Python state machine in `app/services/onboarding/state.py`.
- `GET /onboarding/state`, `POST /onboarding/step/{n}`, `POST /onboarding/complete`, `POST /onboarding/seed-sample-data` (owner-only).
- Refactored `seed_dev_data.py` to accept an `org_id` and a pinned `today`; produces 10 transactions / 5 invoices / 2 commitments deterministically.
- Frontend: 4-step wizard at `/(onboarding)/onboarding/` (org → persona → data → done). `OnboardingGate` client component redirects users whose onboarding is incomplete from any `(shell)` route to `/onboarding`.

### 1.C — Notifications inbox
- `notifications.snoozed_until` column (indexed); list endpoint hides snoozed items from the Unread tab via `OR(snoozed_until IS NULL, snoozed_until <= now())`.
- `notification_preferences` table (per user, per type: `in_app`, `email`). Migration `008`.
- `POST /notifications/{id}/snooze` with discrete durations (`1h | 4h | 24h | monday`).
- `GET/PUT /notifications/preferences`.
- The dedupe path in `app/services/notifications/generators.py` now publishes `notification.created` only on fresh inserts (severity upgrades are silent — bell count unchanged).
- Frontend: `lib/realtime.ts` → `lib/realtime/{index,hooks}.ts`. New `useRealtimeChannel(type, handler)` hook over the SSE client. `<Bell />` mounted in the top-bar with unread badge (clamped to `99+`) + popover preview. `/(shell)/inbox/` page with Unread / All / Archived tabs (URL-synced via `?tab=`), mark-read / archive / snooze row actions, preferences card.

### 1.D — Per-page polish (5 surfaces)
- **Dashboard:** finance `<MetricCard>` + `<Money>` tiles; new `HealthScore` breakdown with accent/warn/danger bands; shared `PageError` shows `X-Request-ID`; named-CTA empty state.
- **Spending:** transactions / rules / commitments on `<DataTable>` (`/` filter, `j`/`k`/Enter navigation, sticky first column); RHF + zod `RuleForm`; charts repainted with `var(--accent)`, `var(--line)`.
- **Invoices:** list / actions / customers / imports — `InvoiceListTable`, `TouchLogDialog` (RHF + zod), `LatenessFingerprint`; imports surface failed-row `request-id`s.
- **Runway:** `ForecastChart` in oklch tokens with custom tooltip ("N sources" → RecordSheet); `MilestoneEdit` (submit-on-blur); `WeeklyTable` with `EvidenceChip` per row; crash-week as `<DeltaBadge>`.
- **Funding:** `RouteCard` (expanded MetricCard for fit-score + token-driven breakdown bars); `OpportunityTable`; `ImprovementChecklist` with evidence chips.

### 1.E — Audit log UI
- Pure-Python filter builder service `app/services/audit/query.py` (cursor-encode/decode included).
- `GET /audit` (cursor paginated; filters: action, entity_type, user_id, from, to) and `GET /audit/export.csv` (streamed) — both admin-only (`requires_role("owner", "admin")`).
- Cursor is base64 `(created_at, id)`; a row inserted between page-1 and page-2 cannot appear in page-2 (verified by test).
- Frontend: `/(shell)/settings/audit/page.tsx` on `<DataTable>` with timestamp / action / entity / user / request-id / details (truncated). Filter bar is URL-synced. Row click opens a `<Sheet>` with full JSON. Export downloads via Blob URL with token forwarded.

### 1.F — Global search (Cmd-K)
- Backend `app/api/routers/search.py` now covers transactions, invoices (by number / customer / status), customers, commitments, funding opportunities, static pages. Cross-tenant isolation verified by a dedicated test.
- Insights search stub returns `[]` (phase 2.F replaces with the Insight Stream content).
- Frontend `useGlobalSearch` debounces 300 ms with a 2-char minimum; `<CommandPalette>` renders Pages plus live grouped results (per-type icons), navigates via `deep_link`, and appends `?openTxnId=…` / `?openInvoiceId=…` to auto-open the RecordSheet on the destination.

## Changes to docs

- `docs/plans/phase-1-{A,B,C,D,E,F}.md` — implementation plans committed before code.
- `docs/changelog/phase-1.md` (this file).
- `docs/parking-lot.md` — additions for deferred items (see "Carried forward" below).

## Tests

**Backend:** `make verify` → ruff clean, mypy clean (102 source files), **161 passed / 6 deselected** in 16 s.

| Suite | Count |
|---|---|
| `test_rbac` | 5 |
| `test_invitations` | 9 |
| `test_password_reset` | 5 |
| `test_members` | 7 |
| `test_onboarding_state` | 12 |
| `test_onboarding_router` | 15 |
| `test_notifications_inbox` | 16 |
| `test_audit_query` | 12 |
| `test_audit_router` | 11 |
| `test_search` | 20 |
| Plus all phase-0 suites (request-id, audit, errors, org-scope, events, runway forecast, etc.) | ~49 |

The 6 deselected are `tests/test_api_contracts.py` marked `integration` — CI brings up Postgres and runs them via `make test-integration`.

**Frontend:** `pnpm verify` → tsc + eslint clean. `pnpm build` succeeds with `ignoreBuildErrors: false`, generating **29 routes**.

## Gate evidence

Quote from `docs/FEATURE_ROADMAP.md`:

> **Gate:** A new user can sign up → onboard → seed sample data → reach the dashboard → navigate every section → drill from any number to evidence → log a touch → recompute the forecast → read an LLM explanation → in under 10 minutes. All without console errors. Lighthouse mobile ≥ 90 on the dashboard.

Evidence:
- Sign-up route exists (`/auth/sign-up` from MVP), onboarding wizard live at `/onboarding` with sample-data seeding endpoint.
- Every `(shell)` route reachable; Cmd-K opens; `g d`/`g r`/`g i`/`g s`/`g f`/`g x` chord shortcuts (added in 0.D).
- Every `(shell)` page renders skeleton / empty / error states with `request-id` surfaced (1.D).
- Touch-log dialog wired (1.D.3); forecast scenario apply still wired from MVP and chart repainted in tokens (1.D.4).
- LLM explain endpoint and `useLLMExplain` hook intact from MVP; guardrails tests pass.
- `pnpm build` exits 0 with strict TypeScript; no console-error production sites.
- Lighthouse mobile not run in this session (no headless Chrome wired); deferred verification to next session before phase-2 cut.

Partial:
- Per-viewport polish (320 / 768 / 1440 px) implemented but not Playwright-snapshot-verified end-to-end in this session.
- Lighthouse ≥ 90 mobile target unverified.

## Commits (selected)

Plans:
- `334d9e3` docs(phase-1): plans for workstreams A through F

1.A:
- `dd3016d..f286b18` — 7 commits across requires_role / invitations / password reset / members / team UI.
- `93d6d89` Merge phase-1.A; `cacada0` pre-merge adapters; `78e0221` post-merge conftest fixes.

1.B (merge `e9f3176`):
- `5fc5b7a` org profile columns + state machine
- `feb865a` router + deterministic seed fixture
- `bbddd4a` API hooks
- `b816cc0` wizard UI + OnboardingGate

1.C: `1a1dfcc` notifications inbox (16 tests, 1 commit by integration).

1.D (merge `a186074`):
- `3bf12c8` dashboard
- `243136c` spending
- `56d92f1` invoices
- `9510880` runway
- `d80ccec` funding

1.E:
- `f5ec671` filter builder + service tests
- `826a9f4` /audit list + CSV export
- `7e3acda` /settings/audit page

1.F:
- `25184ea` per-entity search coverage
- `5aef843` Cmd-K palette to debounced search

Post-merge fixes:
- `f066a17` wrap useSearchParams on /inbox and /settings/audit; fix Org NOT-NULL constraint in generator test.

## Carried forward

Tracked in `docs/parking-lot.md`. Notable:

- **Lighthouse ≥ 90 mobile dashboard.** Not measured in this session; needs headless Chrome run before phase-2 cut.
- **Playwright per-viewport snapshots** for every `(shell)` surface at 320 / 768 / 1440 px. 1.D implemented the responsive structure; we need the deterministic snapshot harness before claiming "no layout shift" across viewports.
- **Toast component / Sonner mount.** 1.C's notification row errors render inline because no toast component is mounted globally. Phase 2 wires Sonner per `docs/DESIGN_SYSTEM.md`.
- **Inbox in side-nav.** 1.C reaches `/inbox` only via the bell or direct URL; add a "Inbox" item to the side-nav in phase 2 polish.
- **Audit page in side-nav.** Currently reached via `/settings/audit/` only; settings sub-nav addition is phase 2.
- **`server_default` on Org's new columns.** Currently the SQLAlchemy ORM default; raw INSERT statements (like one notification test) bypass it. Adding a `server_default` would make any future raw inserts safer.
- **`s_fund` real signal** (carried from phase 0).
- **Real Postgres CI matrix** to run `test_api_contracts` integration suite (carried from phase 0).
- **`next/core-web-vitals` ESLint preset** once flat-config support lands (carried from phase 0).

## Notes for next phase

- The autonomous-build pattern with parallel worktree agents worked again, with two caveats:
  1. **Worktree isolation isn't always real.** Two of the five 1.x agents (1.C, 1.E, 1.F) ended up editing the main repo directly because their worktree path was sparse. Result: concurrent uncommitted edits to shared files (`backend/tests/conftest.py`, `backend/app/main.py`, `frontend/lib/api/queries/index.ts`). We got lucky with the merges; for phase 2 we should either pin worktrees explicitly or have agents always create commits even when in main.
  2. **Agents need to pull current main into their worktree at start.** 1.A and 1.D branched from a stale ref (`a4a8206`, pre-phase-0). 1.A needed an explicit rebase and 0.B-adapter shims. 1.D was savvy enough to fast-forward main into their branch before working. Phase 2 prompts should require this step.
- The `record_audit` helper was tightened to accept either object or id-string forms — keep both for now. The `publish_event_best_effort` queue gives us a fire-and-forget channel that doesn't take a session dep; it'll need a Redis bridge job in phase 5 when real fanout matters.
- The `OnboardingGate` is client-side because the JWT is in `localStorage`. Once we move to httpOnly cookie sessions (phase 5+), this can become a Next.js middleware redirect.
- Per `FEATURE_ROADMAP.md`, phase 2 starts with **2.C (multi-currency migration)** — it blocks 2.A (Plaid). Sequence: 2.C first, then 2.A + 2.B in parallel, then 2.D + 2.E in parallel, then 2.F.
