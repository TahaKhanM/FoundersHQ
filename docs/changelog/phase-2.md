# Phase 2 — Live data (partial: 2.C / 2.E / 2.F)

**Completed:** 2026-05-16

This phase shipped the **no-credentials slice** of phase 2: multi-currency, SSE event wiring, and the Insight Stream. The integration phases that need external developer accounts — **2.A (Plaid)**, **2.B (QuickBooks / Xero / Stripe)**, **2.D (Vercel Blob receipts + OpenAI Vision OCR)** — are deferred until those accounts are provisioned.

## What shipped

### 2.C — Multi-currency
- New `fx_rates` table with composite-unique `(date, source_currency, target_currency)` and snapshot rows from a deterministic source (ECB-style; ingest is decoupled from the actual HTTP fetcher).
- `fx_rate_used` columns added to `transactions` and `invoices`. Existing `currency` on invoices confirmed; new on transactions where missing.
- Migration `009_multi_currency` doubles as a head-merge: collapses divergent alembic heads `005`/`007`/`008` into one linear chain so `alembic upgrade head` no longer raises "multiple heads".
- `app/services/fx/`:
  - `get_rate(session, *, on_date, source, target)` → exact match → most-recent prior → same-currency=1 → `FxRateMissing`.
  - `convert_amount(amount, source, target, on_date, session)` → looks up rate, multiplies, rounds via `round_currency`.
  - `upsert_rates(session, rows)` idempotent bulk-load.
- `/fx` router: `GET /fx/rates` (filterable, auth-gated), `POST /fx/rates` (admin-only, audited).
- CSV ingest auto-attaches `fx_rate_used` on every new Transaction/Invoice; missing-rate degrades to NULL plus an aggregated job warning.
- Frontend: `BaseCurrencyProvider` reads `/org` once on mount; `<Money>` dual-renders (primary in base, source-currency tooltip) when currencies differ; backward-compatible with every existing call site.

### 2.E — Real-time (SSE) event wiring
- `app/services/events/types.py`: `EventType` StrEnum with **34 members across 11 domains** (transactions, invoices, rules, commitments, scenarios, milestones, funding, notifications, onboarding, invitations, memberships, ingest, org, fx, audit, insights).
- `app/deps.get_redis()`: per-process `redis.asyncio.Redis` singleton; tests override with `FakeRedis`.
- **Every mutation route** now publishes:
  - **Durable** (`publish_event` → outbox + Redis) for `transaction.added`, `invoice.created`, `ingest.job_progress`, `org.data_purged`, `onboarding.completed`.
  - **Best-effort** (`publish_event_best_effort` queue) for everything else.
  - Both wrapped in try/except so a Redis outage can never fail the DB commit.
- Worker emits `ingest.job_progress` per chunk via a sync Redis client.
- Frontend `lib/realtime/domain-hooks.ts`: per-domain hooks (`useSpendingRealtime`, `useInvoicesRealtime`, `useRunwayRealtime`, `useFundingRealtime`, `useIngestRealtime`) — each mounted once via a `(shell)/<domain>/layout.tsx`. They invalidate the right SWR keys when their events arrive.
- Reconnect path of `lib/realtime/index.ts` re-dispatches replay events through the same handler chain so subscribed hooks revalidate after a network blip.

### 2.F — Insight Stream
- New `insights` table; migration `010`. Composite index `(org_id, status, created_at desc)`.
- Five **pure-Python generators** in `app/services/insights/`, each taking explicit facts + `today: date` and returning `[InsightCandidate]`:
  - `cash_drop.py` — fires when ending-cash drops > 25% week-over-week.
  - `late_invoice.py` — fires when an invoice crosses `due_date` since the last run.
  - `vendor_spike.py` — fires when a vendor's monthly spend > 1.5× trailing-12-mo average.
  - `commitment_renewal.py` — fires for upcoming charges within 30 days above a configurable threshold.
  - `runway_change.py` — fires when |Δcash_weeks| ≥ 4 vs prior forecast snapshot.
- `run_all.py` orchestrator: loads facts, calls each generator, dedupes by `(org_id, type, sha256(sorted(evidence_ids)))`, persists, audits, publishes `insight.created` (best-effort).
- `/insights` router: list (filter by status), `POST /insights/{id}/dismiss`, `POST /insights/run` (admin-only manual trigger for tests).
- Celery beat placeholder `run_insights_nightly` in `app/tasks/jobs.py`.
- Frontend:
  - `<InsightRow>` mirrors `<NotificationRow>`'s visual rhythm — severity icon, title + type label, body, `<EvidenceChip>`, dismiss button with optimistic update.
  - `<Bell>` unread count = unread notifications + active insights; subscribes to `insight.created`.
  - `/inbox?tab=insights` lists active insights via the existing Tabs UI.

## Deferred (waiting on credentials)

- **2.A — Plaid:** needs `client_id` / `secret` (sandbox is free, production charges per Item).
- **2.B — QuickBooks + Xero + Stripe:** each needs an OAuth app registered in the vendor's developer portal.
- **2.D — Documents & receipts:** needs Vercel Blob bucket env vars and OpenAI Vision API access (per-call cost).

## Changes to docs

- `docs/plans/phase-2-{C,E,F}.md` — plans committed before code.
- `docs/changelog/phase-2.md` (this file).
- `docs/parking-lot.md` — entries for the deferred 2.A/2.B/2.D.

## Tests

**Backend:** `make verify` → ruff + mypy + **262 passed / 6 deselected** in 26 s.

| Suite | Count |
|---|---|
| `test_fx_rates` | 8 |
| `test_fx_conversion` | 8 |
| `test_fx_router` | 8 |
| `test_events_taxonomy` | 4 |
| `test_events_wiring` | 18 |
| `test_insight_cash_drop` | 5 |
| `test_insight_late_invoice` | 5 |
| `test_insight_vendor_spike` | 5 |
| `test_insight_commitment_renewal` | 5 |
| `test_insight_runway_change` | 5 |
| `test_insight_run_all` | 6 |
| `test_insight_router` | 9 |
| Plus all prior suites | ~176 |

**Frontend:** `pnpm verify` → tsc + eslint clean. `pnpm build` → 29 routes, full prerender.

## Gate evidence

Per `docs/FEATURE_ROADMAP.md`:

> **Gate:** A user can connect Plaid, see yesterday's transactions land via SSE, see an auto-generated Insight, upload a receipt and have it auto-match, switch base currency and have all historical totals reconvert deterministically.

Partial-evidence delivered:
- ✓ SSE wiring is live for every mutation; transactions inserted via ingest already emit `transaction.added` and the frontend revalidates.
- ✓ Insights are auto-generated by `run_all` and surface in `/inbox?tab=insights`.
- ✓ Switching `orgs.base_currency` re-rolls every `<Money>` render through the new BaseCurrencyContext + `convert_amount`.

Deferred:
- Plaid connection flow + auto-categorization.
- QBO/Xero/Stripe reconcile view.
- Document upload + OCR auto-match.

## Commits (selected)

Plans:
- `39f4184` docs(phase-2): plans for 2.C / 2.E / 2.F

2.C (merge `60e1370`):
- `57a6f62..8e99d13` — 5 commits across fx tables, get_rate, convert_amount, /fx router, CSV ingest wiring, frontend Money + BaseCurrencyContext.

2.E (merge `f44a3f3..` approx):
- `437ccba` EventType enum + get_redis dep + test fixtures
- `07caba6` backfill publish_event on every mutation route
- `3463cc2` domain realtime hooks + SWR-cache invalidation

2.F:
- `cb83899` insight stream backend + partial frontend (committed by driver after agent stall)
- `b747730` finish frontend integration (Bell count + Insights tab + InsightRow)

## Carried forward

In `docs/parking-lot.md`:

- **2.A, 2.B, 2.D** — implement once external developer accounts exist.
- **Insights drill-down RecordSheet integration.** `<InsightRow>` shows evidence chips but doesn't auto-open a stack of evidence sheets on click — phase 3.E (Copilot) and phase 3.B (Vendor Intel) build that pattern more deeply.
- **Insights state-machine UI.** Dismiss currently is the only transition; add `snooze` and `resolve` later if dedupe-rate evidence suggests we need finer-grained handling.
- **Generator schedule.** `run_insights_nightly` is a placeholder beat task; wire it up properly when the worker fleet is configured for prod.
- **FX rate fetcher.** `upsert_rates` accepts rows but we never call ECB/Open Exchange in production code yet — we only test ingest via `POST /fx/rates`. Add a Celery task that fetches daily and upserts.

## Notes for next phase

- The parallel-agent pattern continues to work but agents are not infallible. 2.F's frontend stalled (watchdog timeout, no progress for 10 min). The driver session salvaged: committed the worktree's uncommitted work, merged, then finished the frontend integration manually. Total turn cost was ~30 min including salvage. Worth budgeting that in the future.
- 2.C's agent merged divergent alembic heads (005 / 007 / 008) into 009 itself — a defensive move that avoided a "multiple heads" error. Document this pattern in the foundershq-conventions skill for future generators.
- The `EventType` enum is now the canonical taxonomy. Any new mutation needs both an `audit` action and a matching enum member; consider lint-gating that pairing in phase 3.
- Phase 3 starts on Tier-2 features (scenarios, vendor intel, customer health, decision engine, AI Copilot). Per `FEATURE_ROADMAP.md`: 3.A + 3.B + 3.C in parallel, 3.D depends on 3.A scenario primitives, 3.E depends on the SSE wiring we just landed. Pause point per /execute-v2: **before 3.E we should confirm Anthropic/OpenAI API budget caps** since the Copilot is the first cost-bearing AI surface.
