# Phase 1.F — Global Search

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use `- [ ]`.

**Goal:** the `<CommandPalette>` from 0.D becomes a real search — pages + transactions + invoices + customers + commitments + funding opportunities + insights (when 2.F lands; here we just leave the channel open). Search is debounced (300 ms) and hits the existing `/search` endpoint.

**Architecture:** the backend `search` router already exists with the `_text_score` / `_recency_score` deterministic ranking. We add coverage for the entity types we don't yet rank, and wire the frontend palette to call `useGlobalSearch` with the active query.

**Tech Stack:** SWR debounced fetch; existing search service.

**Dependencies:** 1.A merged (audit not needed here — search is read-only).

**Skills:** `foundershq-conventions`, `superpowers:test-driven-development`, `vercel:nextjs`.

---

## File structure

### Backend

| Path | Action | Purpose |
|---|---|---|
| `backend/app/api/routers/search.py` | modify | confirm coverage for transactions/invoices/customers/commitments/funding ops; add insights when 2.F lands (stub returns []) |
| `backend/app/services/search/__init__.py` | create-or-modify | re-exports; pure ranking funcs stay in `search.py` for now |
| `backend/tests/test_search.py` | modify | extend tests to cover each entity type; ranking remains deterministic |

### Frontend

| Path | Action | Purpose |
|---|---|---|
| `frontend/components/ui/command-palette.tsx` | modify | accept query → call `useGlobalSearch` → render results grouped by type; navigate or open RecordSheet on select |
| `frontend/lib/api/queries/search.ts` | modify | ensure `useGlobalSearch` debounces 300ms and uses `dedupingInterval` 300 |
| `frontend/components/layout/shortcuts.tsx` | review | unchanged — Cmd-K still opens the palette; the palette now searches |

---

## Tasks

1. **Backend coverage audit** — open `app/api/routers/search.py`; ensure each entity type is queried and ranked. Add tests for any missing type.
2. **Palette query plumbing** — when the user types in the palette input, debounce 300ms and call `useGlobalSearch(query)`. Show "Pages" group at the top (existing static list), then live results grouped by type with icons (Receipt for transaction, FileText for invoice, User for customer, etc).
3. **Result selection** — for each result, deep-link via `deep_link` and pass `open_param` to focus the relevant RecordSheet.
4. **Empty / loading / error states** — palette already has Empty; add a "Searching…" indicator and an error toast.

## Tests

- `test_search.py` extended — each entity type returns results; ordering is deterministic given a fixed seed.
- Playwright: type "AWS" in palette → transaction result appears; press Enter → navigates to `/spending/transactions?openTxnId=…`.

## Hard rules

- No new dependencies.
- Debounce is 300 ms (matches existing search hook); don't drop below 200 ms.
- Search is always scoped to `CurrentOrg`; no cross-tenant results.
- Ranking is deterministic and reproducible (no LLM in the ranker).

## Definition of done

- `make verify` + `pnpm verify` clean.
- Typing in the Cmd-K palette returns results within 350 ms of the last keystroke.
- Selecting a result navigates and opens the right entity's record sheet (where applicable).
- Each existing entity type has a passing test.
