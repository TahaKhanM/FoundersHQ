# Phase 2.C — Multi-Currency

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`. TDD per task.

**Goal:** every transaction and invoice carries its source currency and the FX rate used to express it in the org's base currency. The deterministic core converts at read time using a stored daily FX-rate table; the `<Money>` component renders both source and base values.

**Architecture:** new `fx_rates` table with daily snapshots from a deterministic source (ECB; an HTTP fetcher we don't actually call in tests — tests feed rows directly). Two columns on `transactions` and `invoices` — `currency` (already-present on invoices? confirm) and `fx_rate_used` (Decimal, the rate at write time used to convert to the org's base currency). Conversion helpers in `app/services/fx/`. Frontend: `<Money>` already accepts `currency`/`baseCurrency`; we plumb a `BaseCurrencyContext` from the org.

**Dependencies:** 1.B added `orgs.base_currency` — re-use it. Unblocks 2.A/2.B (Plaid + accounting integrations need this).

**Skills:** `foundershq-conventions` (first), `deterministic-finance`, `superpowers:test-driven-development`, `vercel:nextjs`.

---

## File structure

### Backend

| Path | Action | Purpose |
|---|---|---|
| `backend/app/models/transaction.py` | modify | confirm `currency` column exists; add `fx_rate_used: Decimal | None` |
| `backend/app/models/invoice.py` | modify | same |
| `backend/app/models/fx_rate.py` | create | `FxRate(date, source_currency, target_currency, rate)` |
| `backend/app/models/__init__.py` | modify | export `FxRate` |
| `backend/alembic/env.py` | modify | import `FxRate` |
| `backend/alembic/versions/009_multi_currency.py` | create | autogen + hand-author migration |
| `backend/app/services/fx/__init__.py` | create | re-exports |
| `backend/app/services/fx/rates.py` | create | `get_rate(session, *, on_date, source, target) -> Decimal`; falls back to latest known on or before `on_date`; `convert(amount, rate) -> Decimal` |
| `backend/app/services/fx/conversion.py` | create | `convert_amount(amount, source_currency, target_currency, on_date, session) -> Decimal`; uses `get_rate` |
| `backend/app/services/fx/ingest.py` | create | `upsert_rates(session, rows)` deterministic; idempotent |
| `backend/app/api/routers/fx.py` | create | `GET /fx/rates?source=X&target=Y&from=&to=` (admin or read-only?); `POST /fx/rates` (admin-only) to bulk-load |
| `backend/app/api/schemas.py` | modify | `FxRateDTO`, `FxRateBulkIngestRequest` |
| `backend/app/main.py` | modify | mount `/fx` router |
| `backend/tests/test_fx_rates.py` | create | unit tests for rate lookup + fallback |
| `backend/tests/test_fx_conversion.py` | create | unit tests for `convert_amount` |
| `backend/tests/test_fx_router.py` | create | contract tests |

### Frontend

| Path | Action | Purpose |
|---|---|---|
| `frontend/lib/api/types.ts` | modify | add `fxRateUsed?: number` / `currency: string` to TransactionDTO / InvoiceDTO if not already there |
| `frontend/lib/api/mappers.ts` | modify | propagate the new fields |
| `frontend/components/finance/money.tsx` | modify | when `currency !== baseCurrency`, render base-currency value as the primary text and the original-currency value in a hover tooltip |
| `frontend/lib/base-currency.tsx` | create | `BaseCurrencyProvider` reading from `/org` response; `useBaseCurrency()` hook |
| `frontend/components/providers.tsx` | modify | wrap children in `BaseCurrencyProvider` |
| `frontend/lib/api/queries/org.ts` | create | hook for `/org` (currently org info isn't fetched anywhere) |

---

## Tasks

### Task 1 — FX rate model + migration

1. Failing test: `FxRate(date=date(2026,1,1), source_currency="EUR", target_currency="USD", rate=Decimal("1.05"))` round-trips.
2. Implement model. Composite unique index on `(date, source_currency, target_currency)`.
3. Add to `models/__init__.py` and `alembic/env.py`.
4. Author migration `009_multi_currency.py` (hand-authored — Postgres not running): adds `fx_rates` table + adds `fx_rate_used` to `transactions` and `invoices`.
5. Verify SQLite create-all works.

Commit: `feat(phase-2.C): fx_rates table + fx_rate_used columns`.

### Task 2 — `get_rate` lookup with fallback

`get_rate(session, *, on_date, source, target) -> Decimal`:
- Exact match on `(on_date, source, target)`: return its rate.
- Else, the most recent row with `date <= on_date` matching source/target: return that.
- Else, if `source == target`: return `Decimal("1")`.
- Else, raise `FxRateMissing`.

Tests cover all four branches plus inverse-lookup convenience.

Commit: `feat(phase-2.C): FX get_rate with fallback`.

### Task 3 — `convert_amount`

`convert_amount(amount, source_currency, target_currency, on_date, session) -> Decimal`:
- Looks up rate, multiplies, rounds via `app.utils.money.round_currency`.
- Same-currency short-circuit returns `amount`.

Tests cover round-trip stability (USD→EUR→USD) and rounding.

Commit: `feat(phase-2.C): convert_amount helper`.

### Task 4 — `/fx` router

- `GET /fx/rates?source&target&from&to` — list rows.
- `POST /fx/rates` — admin-only via `requires_role("owner","admin")`; bulk upsert; audited.

Tests cover admin gate + idempotent upsert.

Commit: `feat(phase-2.C): /fx router (rates list + admin bulk upsert)`.

### Task 5 — Frontend Money + BaseCurrencyContext

- `BaseCurrencyProvider` reads `/org` once on mount and exposes `useBaseCurrency()`.
- `<Money>` now: if `currency` is provided and differs from `baseCurrency`, primary renders `Intl.NumberFormat(baseCurrency)` of `value` and hover tooltip shows the original-currency amount when supplied via `originalValue` prop. Default unchanged when `currency === baseCurrency`.
- The `<Money>` prop surface keeps backward compatibility: existing call sites don't break.

No tests yet (no JS runner); add Playwright snapshot in 1.D if time permits.

Commit: `feat(phase-2.C): BaseCurrencyContext + <Money> dual-render`.

### Task 6 — Wire `fx_rate_used` on ingest

For each ingest path that creates Transactions / Invoices today (CSV ingest at `app/api/routers/ingest.py`):
- After detecting source currency (or defaulting to org's `base_currency`), look up the FX rate at the row's date and persist `fx_rate_used`.
- If unknown rate AND source != base: write a row with `fx_rate_used=NULL` and surface a single ingest-job warning ("N rows with unknown FX rate on date X").

Tests cover both branches.

Commit: `feat(phase-2.C): wire fx_rate_used into CSV ingest`.

---

## Hard rules

- Deterministic: any function that computes a converted amount takes `on_date` as a parameter; never reads the clock.
- `Decimal` only on the server. `<Money>` uses tokens already.
- Every mutation route writes audit + publish event.
- No new dependencies.
- `<Money>` keeps the existing zero-prop default behaviour (no surprises for non-multi-currency call sites).

## Definition of done

- `make verify` clean.
- `pnpm verify` clean.
- `pnpm build` exits 0; 29+ routes generate.
- All new tests pass.
- The dashboard renders against seeded sample data and `<Money>` shows the base-currency-converted amount when the source currency differs.
