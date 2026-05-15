# FoundersHQ — Build Roadmap

> Phased delivery. Each phase ends with a working, ship-quality slice. Do not start phase N+1 until phase N passes the gate.

## How to use this file

Each phase lists:
- **Goal** — what becomes possible after this phase.
- **Workstreams** — independent groups of tasks that can be dispatched to parallel subagents (see `superpowers:dispatching-parallel-agents`).
- **Gate** — the bar this phase must clear before the next starts.

When working on a phase, follow:
1. `superpowers:brainstorming` to align on each non-trivial workstream's design before code.
2. `superpowers:writing-plans` for each workstream.
3. `superpowers:test-driven-development` per task (write failing test → make pass → refactor).
4. `superpowers:executing-plans` for the work itself, with the checkpoint reviews it specifies.
5. `superpowers:verification-before-completion` before claiming any workstream done.

---

## Phase 0 — Foundations (no user-visible features)

**Goal:** the codebase is ready to build the rest of the product without thrash.

### Workstreams

**0.A — Repo housekeeping**
- Remove `.DS_Store` files from git; extend `.gitignore`.
- Frontend: turn `typescript.ignoreBuildErrors` off in `next.config.mjs`. Fix the resulting errors.
- Add `tsc --noEmit` and `eslint` to a `pnpm verify` script. Make `pnpm build` run `verify` first.
- Backend: add `ruff` + `mypy` + `pytest` to a `make verify` target.
- Add GitHub Actions CI: backend tests, frontend build, lint on every PR.

**0.B — Cross-cutting backend infra**
- `app/middleware/request_id.py` — attach UUID per request; include in error responses.
- `app/utils/audit.py` — `record_audit(session, *, org, user, action, entity_type, entity_id, details)` used everywhere.
- `app/utils/errors.py` — typed exception → JSON response mapper; `{message, code, request_id, details?}`.
- SQLAlchemy event listener: in dev, raise if an org-scoped insert lacks `org_id`.
- `app/services/events/` — Redis pub/sub publisher, outbox writer.
- `app/api/routers/events.py` — SSE endpoint.

**0.C — Cross-cutting frontend infra**
- `lib/realtime.ts` — SSE client (reconnect, outbox catch-up, typed events).
- `lib/api/queries/` — split `hooks.ts` into per-domain files.
- `lib/permissions.ts` — RBAC guards.
- `components/finance/` — `Money`, `Sparkline`, `EvidenceChip`, `DeltaBadge`, `Scenarios`, `MetricCard`.
- Theme tokens applied per DESIGN_SYSTEM.md. Dark mode by default.
- Remove `IS_MOCK` paths from any component that doesn't need them — keep mocks only inside `lib/api/queries/__mocks__/` for storybook-style local previews.

**0.D — Design system primitives**
- Update `tailwind.config` and `app/globals.css` with new tokens.
- Audit every shadcn component and remove the ones we don't use (we likely don't need `menubar`, `aspect-ratio`, `accordion` for finance UX; keep small).
- Install `@tanstack/react-table` and build `DataTable`.
- Build `CommandPalette` with all current pages and entity searches wired up.

**Gate:** CI green. `pnpm verify` and `make verify` both pass. Dashboard, Runway, Invoices, Spending, Funding pages render against real backend data (no mocks) at 320px, 768px, 1440px. Cmd-K opens and can navigate to every page.

---

## Phase 1 — Finish the MVP, properly

**Goal:** every existing surface is finished, beautiful, fast, and audit-logged.

### Workstreams

**1.A — Auth & team**
- Real `POST /auth/forgot-password`, `POST /auth/reset-password`.
- Magic-link invitations: `POST /org/invitations`, `POST /auth/accept-invite`.
- Roles enforced in middleware via a `requires(role="admin")` dependency.
- `/(shell)/team/page.tsx` — member list, role change, remove, pending invites.
- Audit log entries for every membership change.

**1.B — Onboarding**
- Multi-step wizard at `/onboarding`: org name, base currency, fiscal year, "what brings you here?" (mapped to Persona), sample-data option.
- "Skip and import CSV" path leads into ingest wizard.
- "Start with sample data" seeds the org via the existing `seed_dev_data` for the user's org id.
- Persisted progress so the user can leave and resume.

**1.C — Notifications inbox**
- `/(shell)/inbox/page.tsx` — bell + page.
- Per-type preferences (email / in-app / Slack-later).
- Mark read, archive, snooze.
- SSE-driven live update.

**1.D — Polish each existing page**

For each of: Dashboard, Spending (+ Transactions, Rules, Commitments), Invoices (+ List, Actions, Customers, Imports), Runway, Funding —
- Loading skeletons, empty states with CTAs, error states with request-id.
- Every numeric figure links to evidence via `EvidenceChip` or RecordSheet.
- Inline edit where the existing forms allow it; `react-hook-form` + `zod` elsewhere.
- Keyboard: arrow / j-k on tables, `Esc` closes sheets, hotkeys per DESIGN_SYSTEM.md.
- Charts use `Recharts` with our tokens; tooltips show evidence count.

**1.E — Audit log UI**
- `/(shell)/settings/audit/` — filterable table; CSV export; sticky filters in URL.

**1.F — Search (global)**
- Backend `search` router already exists; ensure it covers transactions, invoices, customers, commitments, insights (when 2.F lands), pages, settings.
- Frontend: the CommandPalette is the search UI.

**Gate:** A new user can sign up → onboard → seed sample data → reach the dashboard → navigate every section → drill from any number to evidence → log a touch → recompute the forecast → read an LLM explanation → in under 10 minutes. All without console errors. Lighthouse mobile ≥ 90 on the dashboard.

---

## Phase 2 — Live data

**Goal:** the user connects real sources and the product comes alive.

### Workstreams

**2.A — Plaid**
- Backend integration module, link-token endpoint, exchange endpoint, daily sync Celery job.
- Dedupe by `plaid_txn_id`. Re-categorize via existing rules.
- Frontend: "Connect bank" in `/integrations` and during onboarding.
- Reconnect flow when item is in error state.

**2.B — QuickBooks + Xero + Stripe**
- OAuth for each. Mappings to internal models.
- Reconciliation view at `/integrations/reconcile`.

**2.C — Multi-currency**
- Migration: add `currency` and `fx_rate_used` to transactions and invoices; `base_currency` to orgs.
- `app/services/fx/` — daily-rate fetch (deterministic source), historical lookup, conversion helpers.
- Frontend: `Money` renders original + base; `BaseCurrencyContext` provides the org's base currency to all hooks.

**2.D — Documents & receipts**
- Vercel Blob configured; `documents` and `document_links` tables.
- Upload UI on transaction and invoice RecordSheets.
- OCR via OpenAI Vision; extracted fields go through guardrails before they affect anything.
- Auto-match by amount + date + merchant similarity; user confirms.

**2.E — Real-time (SSE)**
- Phase 0 laid the pipes; this phase wires emitters in every mutation path and updates SWR caches on the client.

**2.F — Insight Stream**
- `insights` table + state machine.
- Generators in `app/services/insights/` — start with: cash drop, late invoice, vendor spend spike, commitment renewal coming, runway change > 4 weeks.
- Nightly Celery beat job + on-event firings.
- Frontend `/inbox` page (already from 1.C) consumes these in addition to legacy notifications.

**Gate:** A user can connect Plaid, see yesterday's transactions land via SSE, see an auto-generated Insight, upload a receipt and have it auto-match, switch base currency and have all historical totals reconvert deterministically.

---

## Phase 3 — Differentiated intelligence

**Goal:** the features competitors can't fake.

### Workstreams

**3.A — Scenario branches**
- Models, services, UI per PRODUCT_SPEC F8.
- Compare view; promote-to-baseline action.
- Audit log entries on every scenario change.

**3.B — Vendor Intelligence**
- Detection services per PRODUCT_SPEC F9.
- `/vendors` page; findings flow into Insight Stream.

**3.C — Customer Health**
- Daily snapshot job; surface on `/customers` and on the action queue.

**3.D — Decision Engine**
- Structured query UI (`/decisions`).
- Deterministic answer + LLM narration through facts payload + guardrails.
- Save & revisit; "what actually happened" overlay.

**3.E — AI Copilot side panel**
- Cmd-J entry; per-page context payloads; conversation persisted per user, scoped per org.
- Suggested prompts pulled from the current page's data (e.g. on `/invoices`, "Draft chase email for the top 3 overdue").

**Gate:** Every Tier-2 feature ships with at least one Insight Stream integration, at least one keyboard shortcut, and at least three end-to-end Playwright tests covering happy path and one error.

---

## Phase 4 — Sharing & investor surface

### Workstreams

**4.A — Investor share links**
- Signed URLs, frozen snapshots, optional password, revocation.
- `/(public)/share/[token]/` route.

**4.B — Investor Update generator**
- Pulls KPIs, narrative, asks.
- Email-friendly HTML render.

**Gate:** an outside person can open a share link (no auth) and see a clean read-only investor snapshot whose numbers exactly match the org's data at `shared_at`.

---

## Phase 5 — Platform

### Workstreams

**5.A — Integrations marketplace UI** (Slack, Linear, Notion, Email, Webhooks).
**5.B — API keys + public REST API + webhooks.**
**5.C — Mobile PWA polish + Web Push.**

**Gate:** A user can install the PWA on iOS / Android home screen, receive a push on a critical insight, open it, and take action.

---

---

## Phase 6 — Cutting-edge intelligence

> Detailed specs in `docs/CUTTING_EDGE.md`. Every Tier-4 feature must satisfy the same invariants (determinism, evidence, audit) as every Tier-0 feature.

**Goal:** AI features that founders trust because the math is real and the citations are everywhere.

### Workstreams

**6.A — Causal Analyst Agent (F16)**
- New `app/services/agents/` package; tools per `multi-agent-orchestration` skill.
- Anthropic Agent SDK on the server; prompt caching on system prompt and tool schemas.
- New routes: `POST /investigations` (start), `GET /investigations/{id}/stream` (SSE).
- Frontend: timeline UI that unfolds steps as they stream.
- Tests: golden-path investigation; disagrees-when-no-anomaly; budget exceeded; guardrail violation mid-loop.

**6.B — Probabilistic forecast (F17)**
- Extend `app/services/runway/forecast.py` with `run_simulation(num_paths=10000, rng_seed=...)`.
- Variance estimates per category from rolling history; shrinkage prior for low-N.
- New table `forecast_simulations` storing seed + summary bands (no per-path storage).
- Frontend: fan-chart variant of the existing runway chart; P10/P50/P90 toggle.

**6.C — Semantic categorization (F18)**
- Add `pgvector` extension; embedding column on `transactions`.
- Embedding worker (Celery): OpenAI `text-embedding-3-small`, batched.
- Categorization service: nearest-neighbour vote + similarity-weighted confidence.
- Active learning: on category override, increase weight on the corrected example for future neighbours.
- Backwards-compat with existing rule-based categorization (rules win when they match).

**6.D — Time-machine (F19)**
- Append-only `events` table for all input mutations (transaction add/edit/delete, invoice, commitment, profile).
- A `replay_as_of(date)` service that hydrates the deterministic engine from events.
- Frontend: global date picker in top bar; when set, every page rebadges with "viewing as of {date}".
- Tests: replay correctness vs current-state; time-machine perf on 100k events.

**6.E — Capital efficiency dashboard (F27)**
- New service `app/services/efficiency/` with Rule of 40, Burn Multiple, Magic Number, CAC payback, Net New ARR per FTE.
- Frontend: new `/efficiency` page with deterministic metric cards + peer-percentile chip (placeholder until F30).

**Gate:** an investor demo flow works — ask "why did burn rise?" → watch the agent investigate live → click any evidence chip to verify → switch to time-machine and see the same answer a month ago → switch to fan-chart for probabilistic runway.

---

## Phase 7 — Native experiences (off-platform reach)

> The features that meet founders where they already are.

### Workstreams

**7.A — Voice Copilot (F23)**
- OpenAI Realtime API on the frontend; backend exposes `POST /copilot/voice/session` to return ephemeral tokens.
- Always-on listening with a hotkey (Cmd-Shift-V); transcription rendered in a sidebar.
- The voice path reuses the existing facts-payload + guardrails plumbing.

**7.B — Email AI (F24)**
- Inbound email provider (Resend or Postmark).
- Each org has a unique forwarding address; Celery worker classifies and routes (invoice → ingest, receipt → vault, payment confirmation → matcher).
- Outbound draft: investor data request → AI assembles draft reply with cited evidence; user reviews and sends from their own client.

**7.C — Document Intelligence Vault (F20)**
- `documents` table for type-classified uploads (pitch deck, model, SAFE, term sheet, cap table).
- OpenAI Vision + structured-output extraction; results stored in `extracted_terms` JSONB.
- Cross-document checks: SAFE cap vs term-sheet valuation, model assumptions vs current burn.
- Frontend: `/vault` page; detail view with extracted terms and inconsistencies.

**7.D — Browser Extension SaaS Tracker (F35)**
- Manifest V3 extension; permissions limited to user-listed billing domains.
- Local-only cache of "saw a checkout" records; user-initiated sync to backend.
- Match against existing commitments; surface "you might be paying for X".

**7.E — Slack-Native Approvals (F29)**
- App-level Slack integration with Block Kit approval flows.
- Signed approval tokens; one-time use; deep links back to FoundersHQ.
- Audit log entries for every approval action.

**Gate:** a founder can complete a full week of work without opening the web app — voice queries for status, email-forward for new invoices, Slack approvals for share links and scenario merges.

---

## Phase 8 — Open ecosystem & power tools

### Workstreams

**8.A — Public benchmark network (F30, opt-in)**
- Separate `benchmarks` schema; weekly aggregation job; k-anonymity ≥ 10; differential noise on shared metrics.
- Settings toggle for participation; benchmark surfaces appear only when participating.

**8.B — Template marketplace (F31)**
- `templates` table with org-private and public scopes; explicit publish.
- Frontend `/templates` library; fork-into-org action.

**8.C — Vercel Sandbox (F32)**
- Python notebook surface backed by `vercel:vercel-sandbox`.
- Read-only API token scoped to the running org and the user's role.
- Audit log entry per execution.

**8.D — Federated reporting for investors (F33)**
- Investor-tenant model; explicit grant flow per portco.
- Investor portfolio dashboard with aggregations only (no row-level access).

**8.E — Cryptographic audit exports (F34)**
- Ed25519 signing of export packages; per-org key derivation.
- Public verifier route.

**8.F — Live Financial Model (F21)**
- Custom grid; server-side formula eval; versioned snapshots; XLSX import/export.
- Cells can call `metric(...)`, `forecast(...)`, `evidence(...)` against live data.

**Gate:** a power user can build a custom hiring-plan model in the app, share it with their investor via the federated portal, and sign the export for the auditor — all without touching Excel or DocuSign.

---

## Cross-cutting quality bar (applies to every phase)

- Every router mutation writes an audit log entry.
- Every LLM call routes through `validate_llm_response`.
- Every list endpoint supports cursor pagination (no `LIMIT 1000`).
- Every page renders three states: loading skeleton, empty with CTA, error with request-id.
- Backend unit tests for every service function. API contract tests at the router level. Playwright tests for the happy path of every Tier-1 user flow.
- Zero `any` types in new TypeScript. Zero `# type: ignore` in new Python.
- Every secret read via `app/config.py`. No process.env in components.
