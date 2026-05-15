# Phase 2.F — Insight Stream

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** the product proactively surfaces things to look at — a sudden cash drop, an invoice that just crossed late, a vendor whose monthly spend spiked, a commitment due to renew, a runway change > 4 weeks. Insights flow into the existing `/inbox` (1.C) alongside notifications.

**Architecture:** new `insights` table; 5 deterministic generators in `app/services/insights/` (each a pure function: facts in, list of Insight rows out). A Celery beat job runs nightly; on-event firings (via `publish_event` listener in the worker) run a subset of generators on the affected entity. Frontend `/inbox` already exists from 1.C; we add a tab `Insights` and let the bell count include them.

**Dependencies:** 2.C merged (insights compute in base currency). 2.E merged (we publish `insight.created`).

**Skills:** `foundershq-conventions`, `deterministic-finance` (must-load), `realtime-and-streaming`, `superpowers:test-driven-development`.

---

## File structure

### Backend

| Path | Action | Purpose |
|---|---|---|
| `backend/app/models/insight.py` | create | `Insight(org_id, type, severity, title, body, evidence_ids JSONB, status, created_at, dismissed_at)` |
| `backend/app/models/__init__.py` | modify | export |
| `backend/alembic/env.py` | modify | import |
| `backend/alembic/versions/010_insights.py` | create | hand-author migration |
| `backend/app/services/insights/__init__.py` | create | barrel of generators |
| `backend/app/services/insights/cash_drop.py` | create | pure func `detect_cash_drop(today, history) -> [Insight]` |
| `backend/app/services/insights/late_invoice.py` | create | same shape |
| `backend/app/services/insights/vendor_spike.py` | create | same |
| `backend/app/services/insights/commitment_renewal.py` | create | same |
| `backend/app/services/insights/runway_change.py` | create | same — fires when runway base or pess shifts > 4 weeks compared with previous snapshot |
| `backend/app/services/insights/run_all.py` | create | orchestrator: loads facts, calls each generator, dedupes by `(org_id, type, evidence_hash)`, persists |
| `backend/app/api/routers/insights.py` | create | `GET /insights?status=active`, `POST /insights/{id}/dismiss`, `POST /insights/run` (admin-only manual trigger for tests) |
| `backend/app/api/schemas.py` | modify | `InsightDTO`, `InsightListResponse` |
| `backend/app/tasks/jobs.py` | modify | new Celery beat task `run_insights_nightly` |
| `backend/app/main.py` | modify | mount `/insights` |
| `backend/tests/test_insight_cash_drop.py` | create | unit tests per generator |
| `backend/tests/test_insight_late_invoice.py` | create | … |
| `backend/tests/test_insight_vendor_spike.py` | create | … |
| `backend/tests/test_insight_commitment_renewal.py` | create | … |
| `backend/tests/test_insight_runway_change.py` | create | … |
| `backend/tests/test_insight_run_all.py` | create | orchestrator + dedupe |
| `backend/tests/test_insight_router.py` | create | contract |

### Frontend

| Path | Action | Purpose |
|---|---|---|
| `frontend/lib/api/types.ts` | modify | `InsightDTO`, severity enum |
| `frontend/lib/api/mappers.ts` | modify | mapper |
| `frontend/lib/api/queries/insights.ts` | create | hooks |
| `frontend/lib/api/queries/index.ts` | modify | export |
| `frontend/components/notifications/notification-row.tsx` | modify | render either Notification or Insight (small union) |
| `frontend/app/(shell)/inbox/page.tsx` | modify | new tab "Insights" (URL `?tab=insights`); list active insights, dismiss action |
| `frontend/components/notifications/bell.tsx` | modify | unread count = unread notifications + active insights |

---

## Tasks

1. **Insight model + migration.** Composite index `(org_id, status, created_at desc)`. Migration 010.

2. **Cash-drop generator.** Pure function `detect_cash_drop(today, weekly_cash_history) -> list[Insight]`. Fires when latest week's ending_cash drops by more than 25% from the prior week, with evidence the txns that caused the drop. Tests: stable / spike up / spike down / cliff edge.

3. **Late-invoice generator.** `detect_newly_late(today, invoices) -> list[Insight]`. Fires when an invoice crossed `due_date` since the last run. Evidence ids = `[invoice_id]`. Test edge cases: same day, weekend, paid late.

4. **Vendor-spike generator.** `detect_vendor_spend_spike(today, vendor_history) -> list[Insight]`. Fires when a vendor's monthly spend is > 50% of trailing-12mo average. Tests: stable / first-month / spike / shrink.

5. **Commitment-renewal generator.** `detect_renewals_coming(today, commitments, lookahead_days=30)`. Fires for commitments whose next charge date is within `lookahead_days` and whose amount is above a threshold ($500 default). Tests: timing windows + threshold.

6. **Runway-change generator.** `detect_runway_change(prev_forecast, new_forecast)`. Fires when |new.cash_weeks - prev.cash_weeks| >= 4. Evidence = top-3 weekly attribution rows.

7. **Orchestrator `run_all`.** Loads org facts (transactions, invoices, commitments, runway forecast, last insight snapshot), calls each generator, dedupes against existing active insights by `(type, sha256(sorted(evidence_ids)))`, persists new rows, audits each insertion. Publishes `insight.created` via `publish_event_best_effort`.

8. **`/insights` router.** List (filter by `status`), dismiss (`requires_role("owner","admin")` or any member — TBD; default any member). Manual `POST /insights/run` admin-only.

9. **Celery beat task.** `run_insights_nightly` calls `run_all` per org. Add to `app/tasks/jobs.py` beat schedule.

10. **Frontend `/inbox` tab + bell count update.** New tab merges insights into the existing row component (small union type). Bell totals notifications + insights.

## Hard rules

- Generators are pure Python with explicit `today` / inputs. **Never call the clock inside.**
- Generators return `Insight` dataclasses; the orchestrator persists. Generators have no DB access.
- Each insight must carry `evidence_ids` so the frontend chip works.
- Deduplication uses `(org_id, type, sha256(sorted(evidence_ids)))` as the key so re-runs are idempotent.
- The orchestrator audits each insight create and publishes `insight.created`.
- Severity is one of `info | warn | critical`; computed inside the generator from the facts (no LLM).

## Definition of done

- `make verify` clean.
- `pnpm verify` clean.
- Each generator has its own test file with at least 4 cases.
- The orchestrator test exercises dedupe + persistence.
- `/insights` returns active insights for the seeded sample data after running `POST /insights/run` once.
- `/inbox?tab=insights` renders them in the existing layout.
