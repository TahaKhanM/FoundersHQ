# FoundersHQ — Architecture

## Current state (after MVP)

```
┌─────────────────────────────┐         ┌─────────────────────────────┐
│ Next.js 16 App Router       │  HTTPS  │ FastAPI                     │
│ React 19 / Tailwind v4      │ ◀─────▶ │ SQLAlchemy 2 async          │
│ shadcn/ui                   │  JWT    │ Pydantic v2                 │
│ SWR hooks (mock | real)     │         │ Org-scoped routers          │
└─────────────────────────────┘         └──────────────┬──────────────┘
                                                       │
                                                       ▼
                                        ┌──────────────────────────────┐
                                        │ Celery worker(s)             │
                                        │ - imports / parsing          │
                                        │ - reports                    │
                                        └──────────────┬───────────────┘
                                                       │
                                ┌──────────────────────┼─────────────────────┐
                                ▼                      ▼                     ▼
                        ┌──────────────┐       ┌──────────────┐      ┌──────────────┐
                        │ Postgres 15  │       │ Redis 7      │      │ OpenAI       │
                        │ (truth)      │       │ (broker)     │      │ (explain)    │
                        └──────────────┘       └──────────────┘      └──────────────┘
```

## Target state (after Tier 3)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Next.js 16 App Router (Vercel)                                              │
│ App Shell · Dashboard · Spending · Invoices · Runway · Funding · Inbox      │
│ Decisions · Vendors · Customers · Documents · Integrations · Settings       │
│   SWR + SSE (live) + Vercel Blob (uploads) + AI Copilot side-panel          │
└────────────┬──────────────────────────────────────┬─────────────────────────┘
             │ REST + SSE                           │ Public share links
             │ Authorization: Bearer / Cookie       │ (read-only, signed)
             ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FastAPI (api.foundershq.app)                                                │
│  routers/   auth · org · ingest · spending · invoices · runway · funding    │
│             llm · customers · integrations · search · notifications         │
│             dashboard · vendors · decisions · scenarios · documents         │
│             events (SSE) · share · webhooks · api_keys                      │
│  services/  per-domain pure logic — deterministic engine                    │
│  middleware request_id · audit · rate_limit · org_scope                     │
└─────┬──────────────┬───────────────────┬───────────────┬────────────────────┘
      │              │                   │               │
      ▼              ▼                   ▼               ▼
┌──────────┐  ┌───────────────┐   ┌─────────────┐  ┌────────────────┐
│Postgres15│  │ Redis 7       │   │ Vercel Blob │  │ OpenAI         │
│ +pgvector│  │ broker/cache  │   │  receipts   │  │  explain · OCR │
│          │  │ +pub/sub      │   │  exports    │  │  embeddings    │
└────┬─────┘  └──────┬────────┘   └─────────────┘  └────────────────┘
     │               │
     │               │ (events fanout via Redis pub/sub → SSE per org)
     ▼               │
┌──────────────────────────────────────────────────────────────────────┐
│ Celery workers + beat (scheduled jobs)                               │
│  ingest:    bank_sync (Plaid) · accounting_sync (QBO, Xero, Stripe)  │
│  parsing:   csv · ocr · transaction normalization                    │
│  compute:   forecast_recompute · health_scores · vendor_intel        │
│             insight_stream · anomaly_detection                       │
│  digests:   slack · email                                            │
│  exports:   pdf_reports                                              │
└──────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────────┐
│ External                                                             │
│  Plaid · QuickBooks · Xero · Stripe · Slack · Linear · Notion        │
│  ECB / Open Exchange Rates · Resend (email)                          │
└──────────────────────────────────────────────────────────────────────┘
```

## Boundaries that matter

### 1. Deterministic core / LLM periphery
- All `app/services/<domain>/*.py` files are **pure Python** with type-annotated inputs and outputs. No I/O inside metric functions; the router fetches rows, the service computes. This is what makes metrics testable in milliseconds and provably reproducible.
- The LLM lives in `app/services/llm/` and only at endpoints under `/llm/*`, `/decisions/*` (narration), `/investor-update/*`, and the AI Copilot endpoint. **Every LLM call must go through `validate_llm_response`** before its output reaches a user.

### 2. Multi-tenant safety
- `CurrentOrg` is injected into every route. No raw DB queries that don't filter by `org_id`. Add a SQLAlchemy event listener in `models/base.py` that asserts `org_id` is present on every insert for org-scoped tables (development-mode invariant; raises in non-prod, logs in prod).
- All shared resources (Blob keys, share-link tokens, webhook URLs) include the `org_id` in their path/payload and are signed with HMAC keyed by a per-org secret.

### 3. Evidence-first responses
- Any service function that computes a derived insight (an alert, an action-queue item, a vendor-intel finding, a runway dip explanation) **must** return `evidence_ids: list[str]` alongside the values it surfaces.
- Routers must pass `evidence_ids` through to the response schema. Frontend `EvidenceLink` and `RecordSheet` resolve them on click.

### 4. Audit log = append-only
- `audit_logs` table grows forever (with archival to cold storage out of scope for now). Every mutation route writes an entry via a `record_audit()` helper in `app/utils/audit.py`. Mutations without an audit entry should fail review.

## New backend modules (Tier 1+)

| Path | Purpose |
|---|---|
| `app/integrations/plaid/` | OAuth, link tokens, sync handler, dedupe-by-`plaid_txn_id` |
| `app/integrations/quickbooks/` | OAuth, sync, mapping to internal invoice/transaction models |
| `app/integrations/xero/` | OAuth, sync |
| `app/integrations/stripe/` | OAuth, payouts → transactions, customers |
| `app/integrations/slack/` | Outbound webhooks, slash commands, OAuth |
| `app/integrations/linear/` | Outbound (create issue from insight) |
| `app/services/fx/` | Daily rates pull, conversion helpers, historical-rate lookup |
| `app/services/documents/` | OCR pipeline, document↔transaction matching |
| `app/services/scenarios/` | Branch-style forecast scenarios |
| `app/services/vendors/` | Duplicate / unused / renewal detection |
| `app/services/decisions/` | Tradeoff analyses (hire-vs-runway, cut-vs-runway) |
| `app/services/insights/` | Insight Stream generators + state machine |
| `app/services/customer_health/` | Health scoring, at-risk tagging |
| `app/services/events/` | Redis pub/sub fanout helpers |
| `app/services/share/` | Signed link generation, snapshot freezing |
| `app/api/routers/events.py` | SSE endpoint per org |
| `app/api/routers/share.py` | Public share-link consumption |
| `app/api/routers/webhooks.py` | Inbound integration webhooks |
| `app/api/routers/api_keys.py` | API key CRUD |
| `app/middleware/request_id.py` | Inject a per-request UUID for audit + tracing |
| `app/middleware/rate_limit.py` | Token bucket per IP / per API key |

## Database additions

New tables (each with `org_id`):

- `accounts` — bank/accounting accounts; one per Plaid/QBO connection
- `connections` — OAuth tokens (encrypted at rest with `cryptography.Fernet`, key from env)
- `documents` — receipts, exports; references Blob key
- `document_links` — document ↔ transaction/invoice
- `fx_rates` — daily rate snapshots, deterministic source of truth for historical conversion
- `scenarios` — forecast branches
- `scenario_overrides` — typed override rows (hire, cut, raise) per scenario
- `vendor_findings` — duplicate/unused/renewal/price-hike
- `decisions` — saved decision queries
- `insights` — insight stream items
- `customer_health_snapshots` — daily score per customer
- `share_links` — signed public links with frozen snapshot data
- `api_keys` — hashed keys + metadata
- `webhook_subscriptions` — outbound webhook config
- `events_outbox` — durable outbox for SSE/webhook fanout

Add to existing tables:
- `transactions`: `currency`, `fx_rate_used`, `plaid_txn_id`, `qbo_txn_id`, `stripe_payout_id`, `category_overridden_at`
- `invoices`: `currency`, `fx_rate_used`, `qbo_invoice_id`, `xero_invoice_id`, `stripe_invoice_id`
- `users`: `last_seen_at`, `notification_prefs JSONB`
- `memberships`: `role` already exists — enforce in middleware
- `orgs`: `base_currency`, `industry`, `stage`, `fiscal_year_start_month`

## Real-time path (SSE)

1. A mutation in a router (e.g. `transaction.added`) calls `events.publish(org_id, type, payload)`.
2. `publish` writes to `events_outbox` (durability) and `PUBLISH events:{org_id}` on Redis.
3. The `/events` router holds an HTTP connection per active client, subscribed to that Redis channel.
4. The frontend reconnects with exponential backoff; on reconnect, it fetches `events_outbox` rows since `last_event_id` to catch up.

Why SSE not WebSockets: one-way is all we need; HTTP works with all proxies; no extra infra.

## Frontend additions (Tier 1+)

| Path | Purpose |
|---|---|
| `app/(shell)/inbox/` | Insight Stream |
| `app/(shell)/decisions/` | Decision Engine |
| `app/(shell)/vendors/` | Vendor Intelligence |
| `app/(shell)/documents/` | Receipt vault |
| `app/(shell)/scenarios/` | Scenario branches + comparison |
| `app/(shell)/integrations/` | Connect / configure integrations |
| `app/(shell)/team/` | Member list, invites, RBAC |
| `app/(shell)/settings/` | Profile, org, currency, fiscal year, API keys, share-link management |
| `app/(public)/share/[token]/` | Public investor share view |
| `app/(public)/legal/` | Privacy / Terms / Status |
| `components/copilot/` | AI Copilot side panel (Cmd-J) |
| `components/finance/` | Money, sparkline, evidence-chip, scenario-diff, deltabadge |
| `lib/realtime.ts` | SSE client with reconnect + outbox catch-up |
| `lib/api/queries/` | One file per domain — keep `hooks.ts` from becoming 2000 lines |
| `lib/permissions.ts` | Role guards on the frontend (the backend is still the boundary) |

## Hosting

- **Frontend:** Vercel (Next.js 16, region: closest to backend).
- **Backend:** containerised FastAPI on Fly.io or Railway (single region, plus a read-replica region for the SSE endpoint if traffic justifies).
- **DB:** Neon Postgres (autoscale, with branching for preview envs).
- **Blob:** Vercel Blob.
- **Email:** Resend.
- **Background:** Celery workers on the same host as the API; Redis on Upstash.
- **Secrets:** stored in Vercel/Fly env vars; org-level encryption keys derived from a master via HKDF.

## Performance budgets

- p95 read endpoint: < 300ms (current MVP is well within this on seed data).
- Dashboard time-to-interactive: < 1.5s on a cold visit.
- Forecast recompute job: < 2s for 5 years of weekly buckets.
- LLM round trip: < 3s p95, with a streamed first token < 800ms.
- Page-level TBT (Lighthouse): < 200ms.
