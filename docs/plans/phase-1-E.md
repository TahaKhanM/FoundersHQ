# Phase 1.E — Audit Log UI

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use `- [ ]`.

**Goal:** a filterable table at `/settings/audit/` over the `audit_logs` rows already being written by every mutation route (after 1.A); CSV export; filters sticky in URL.

**Architecture:** new GET endpoint with cursor pagination + filters; one page on the frontend using `<DataTable>` from 0.D; CSV export delivered via a streaming endpoint.

**Tech Stack:** FastAPI streaming response (CSV); shadcn select; `<DataTable>` sorting/filter.

**Dependencies:** 1.A merged (so audit rows are being generated for all phase-1 mutations).

**Skills:** `foundershq-conventions`, `superpowers:test-driven-development`, `vercel:nextjs`.

---

## File structure

### Backend

| Path | Action | Purpose |
|---|---|---|
| `backend/app/api/routers/audit.py` | create | `GET /audit` (cursor paginated, filters) + `GET /audit/export.csv` |
| `backend/app/api/schemas.py` | modify | `AuditLogDTO`, `AuditLogListResponse`, filter Pydantic model |
| `backend/app/services/audit/__init__.py` | create | re-export |
| `backend/app/services/audit/query.py` | create | pure builder: turn filters into a SQLAlchemy select; tested in isolation |
| `backend/app/main.py` | modify | mount the router under `/audit` |
| `backend/tests/test_audit_query.py` | create | unit tests for the filter builder |
| `backend/tests/test_audit_router.py` | create | contract tests via test client |

### Frontend

| Path | Action | Purpose |
|---|---|---|
| `frontend/app/(shell)/settings/audit/page.tsx` | create | the audit log page |
| `frontend/components/settings/audit-filters.tsx` | create | filter bar (action, entity_type, user, date range) |
| `frontend/lib/api/queries/audit.ts` | create | hooks: list (paginated), export (returns a blob URL) |
| `frontend/lib/api/queries/index.ts` | modify | export |

---

## Tasks

1. **Filter builder service** — pure function taking a filter dict and producing a SQLAlchemy `select(AuditLog)` with applied filters. Tests with fixtures pinned date ranges.
2. **GET /audit** — admin-only (`requires_role("owner", "admin")`). Query params: `action`, `entity_type`, `user_id`, `from`, `to`, `cursor`, `limit` (default 50, max 200). Cursor = base64-encoded `(created_at, id)` for stable pagination.
3. **GET /audit/export.csv** — streaming CSV; admin-only; respects same filters. Headers: `Content-Type: text/csv`, `Content-Disposition: attachment`.
4. **Page** — `<DataTable>` with columns: timestamp, action, entity, user, request_id (link to copy), details (truncated, expandable). Filters URL-synced via `useSearchParams` + history.
5. **Export button** — calls export endpoint, downloads file. Toast on success.

## Tests

- `test_audit_query.py` — filter combinations.
- `test_audit_router.py` — admin gate; pagination cursor stability; CSV shape.
- Playwright: filter by action, see results narrow; export downloads a CSV.

## Hard rules

- Admin-only routes; member role → 403.
- No PII in CSV beyond what's already in `audit_logs` (we don't widen the schema).
- `details` JSONB is rendered as compact JSON in the table; full JSON in a modal/sheet.
- Date filters default to "last 30 days"; URL params override.

## Definition of done

- `make verify` + `pnpm verify` clean.
- `/settings/audit/` renders 10 rows from the seed data with filters working.
- CSV export produces a valid file with the same row count as the filtered API result.
