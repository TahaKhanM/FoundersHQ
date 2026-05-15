# Phase 2.E — Real-time (SSE) wiring

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** every mutation in the API publishes an event so the SSE pipeline laid in 0.B comes alive. Frontend hooks subscribe to relevant channels and revalidate SWR caches.

**Architecture:** mutations call `publish_event` (durable: writes outbox row, PUBLISHes on Redis) where atomicity matters, or `publish_event_best_effort` (in-process queue) where fire-and-forget is acceptable. Phase 0.B + 1.A established both. Phase 2.E backfills coverage on every other mutation route (spending, invoices, runway, funding, notifications, org, ingest). Frontend adds typed channel subscriptions that invalidate domain query caches.

**Dependencies:** 2.C merged (transaction/invoice ingest publishes converted-amount events). Independent of 2.F (which produces additional event types).

**Skills:** `foundershq-conventions`, `realtime-and-streaming` (must-load), `superpowers:test-driven-development`, `vercel:nextjs`.

---

## Event taxonomy

Defined once in a new `app/services/events/types.py`:

```python
class EventType(str, Enum):
    TRANSACTION_ADDED = "transaction.added"
    TRANSACTION_UPDATED = "transaction.updated"
    TRANSACTION_CATEGORIZED = "transaction.categorized"
    INVOICE_CREATED = "invoice.created"
    INVOICE_UPDATED = "invoice.updated"
    INVOICE_TOUCHED = "invoice.touched"
    RULE_CREATED = "rule.created"
    RULE_UPDATED = "rule.updated"
    COMMITMENT_UPDATED = "commitment.updated"
    SCENARIO_APPLIED = "scenario.applied"
    MILESTONE_UPDATED = "milestone.updated"
    FUNDING_OPP_SAVED = "funding.opportunity_saved"
    NOTIFICATION_CREATED = "notification.created"   # 1.C already emits
    NOTIFICATION_UPDATED = "notification.updated"   # 1.C already emits
    ONBOARDING_COMPLETED = "onboarding.completed"   # 1.B
    INVITATION_CREATED = "invitation.created"       # 1.A
    MEMBERSHIP_ROLE_CHANGED = "membership.role_changed"  # 1.A
    INGEST_JOB_PROGRESS = "ingest.job_progress"     # NEW
```

(Anything in 1.A and 1.C already emits some of these via `publish_event_best_effort`; keep using that for low-stakes events and switch to durable `publish_event` only for events the frontend needs to catch up via outbox after reconnect.)

---

## Tasks

### Task 1 — Event taxonomy

Create `app/services/events/types.py` with the `EventType` enum. Re-export from `__init__`. Convert existing string literals in 1.A/1.C routes to enum values.

Tests: enum values are stable (a snapshot test against the literal values).

Commit: `feat(phase-2.E): event-type enum`.

### Task 2 — Backfill `publish_event` calls

For each existing mutation route (search via `grep -n 'record_audit' backend/app/api/routers/*.py` — every audit call should have a matching publish):

1. `spending`: PATCH transaction category, POST rules, POST commitments.
2. `invoices`: POST touch logs, PATCH invoice, POST imports (single per job, plus `INGEST_JOB_PROGRESS` from worker).
3. `runway`: POST scenario apply, POST milestones, PATCH milestone, DELETE milestone.
4. `funding`: POST saved opportunity, DELETE saved opportunity.
5. `notifications`: ensure 1.C's mark-read / archive emit `NOTIFICATION_UPDATED`.
6. `ingest`: emit `INGEST_JOB_PROGRESS` per chunk from the Celery worker.
7. `org`: delete-data emits `org.data_purged`.

Use `publish_event_best_effort` for everything except `transaction.added` / `invoice.created` / `ingest.job_progress` which use durable `publish_event` (these power dashboard catch-up).

Tests cover at least one emit per route via `drain_events()`.

Commit: `feat(phase-2.E): wire publish_event across mutation routes`.

### Task 3 — `get_redis` FastAPI dep

`app/deps.py`: add `get_redis()` async dep that returns a `redis.asyncio.Redis` client built from `settings.redis_url`. Single instance per app (FastAPI app state). Used by the durable `publish_event` calls.

Tests: dep returns a redis-like object (mocked in tests).

Commit: `feat(phase-2.E): get_redis FastAPI dep`.

### Task 4 — Frontend realtime hooks per domain

For each domain (spending, invoices, runway, funding, notifications, ingest), add a `use<Domain>Realtime()` hook that subscribes to its events and invalidates the right SWR keys via `mutate(...)` from the SWR cache.

`lib/realtime/domain-hooks.ts` (new):

```ts
export function useSpendingRealtime() {
  useRealtimeChannel("transaction.added", () => mutate("/spending/transactions"))
  useRealtimeChannel("transaction.categorized", () => mutate(/^\/spending/))
  useRealtimeChannel("rule.created", () => mutate("/spending/rules"))
  // ...
}
```

Each `(shell)/<domain>/layout.tsx` calls its domain hook once on mount.

Commit: `feat(phase-2.E): realtime hooks per domain + layout mounts`.

### Task 5 — Reconnect catch-up

The `lib/realtime/index.ts` client already calls `/events/replay?since=<seq>` on reconnect. Verify it correctly re-dispatches events through the same `dispatch` path so subscribed hooks revalidate. Add a test (manual or Playwright) that emits a durable event, disconnects the client, reconnects, and confirms the cache is revalidated.

Commit: `test(phase-2.E): reconnect catch-up runs subscribers`.

---

## Hard rules

- `publish_event` (durable) for events whose loss after a reconnect would mislead the dashboard. `publish_event_best_effort` for everything else.
- Wrap publishes in try/except so a Redis outage cannot fail the DB commit.
- Use the `EventType` enum — no raw strings outside the enum file.
- No new dependencies.
- Don't fire-and-forget anything that drives a cash-flow metric without going through the outbox.

## Definition of done

- `make verify` clean.
- `pnpm verify` clean.
- A manual test (or playwright if available) shows: open `/dashboard` in browser; in another tab, hit a mutation route via curl; the dashboard refreshes without manual reload within 2 s.
- Reconnect after `/events/replay?since=...` returns prior events and the same revalidation happens.
- Each domain has at least one test asserting the publish call.
