# FoundersHQ — Product Specification

> Source-of-truth for what we're building. Update this file when scope changes.

## North Star

**The CFO co-pilot that never lies.**

FoundersHQ is the financial operating system for early-stage startups. Every number is reproducible from raw data. Every AI insight cites its sources. Every recommendation comes with the math. We are the opposite of "ChatGPT with a finance prompt" — we are a deterministic engine with an LLM narrator on top.

## Why we win

Three product invariants that competitors don't have, won't copy, and can't fake:

1. **Determinism.** Every metric on the screen can be re-derived from stored rows. No hallucinated numbers, ever.
2. **Evidence.** Every causal claim ("burn rose because…") cites transaction or invoice UUIDs. The user can click through to the underlying record in one tap.
3. **Auditability.** Every data change, every LLM call, every action is logged with who/when/why. Investor-, board-, and SOC2-ready.

If a proposed feature would compromise one of these, redesign the feature, not the invariants.

## Personas

- **Solo Founder Ash** — pre-seed, US$500k bank balance, no finance background, scared of running out. Wants: weekly "are we OK?" check, where the money is going, when to raise. Time budget: 15 min/week.
- **CEO+Ops Brigid** — seed, $2M raised, 8 people. Wants: collections discipline, forecast we share with the board, a single source of truth for the team. Time budget: 1 hr/week, plus daily glance.
- **Operator Chen** — Series A, $20M, finance hire on the way. Wants: clean data the finance hire can take over, tight control over commitments, scenario planning for hiring. Time budget: until something breaks.

Every feature must map clearly to at least one persona. If a feature only helps Chen, ship it behind a workspace toggle.

---

## Feature inventory

### Tier 0 — Finish the MVP that exists

The repo already has working primitives. These must be brought to a finished, beautiful, error-free state before any new work begins.

- **Auth & multi-org**: real RBAC (owner/admin/member). Switcher UI. Invitations by email.
- **Ingest**: CSV transactions, CSV invoices, questionnaire. Validation surfaces. Re-import & undo.
- **Spending**: metrics, categories, rules, commitments, alerts. Drill-through from any number to the underlying transactions.
- **Invoices**: list, detail, customers, action queue, touches, templates, parsing jobs.
- **Runway**: weekly forecast, scenarios, milestones, attribution.
- **Funding Fit**: routes ranking, opportunities, save list, timeline, improvements.
- **LLM Explain & Draft Collection Message**: existing endpoints, but wired into every page that has numbers, not just a separate explain page.
- **Notifications**: persistent, deduped, with deep links. Bell in top bar. Inbox page. Per-type preferences.
- **Global command palette (Cmd-K)**: search records, jump to pages, run actions.
- **Audit log UI**: filter by user/action/entity, export to CSV.

### Tier 1 — Live data, live forecast, live work

The pieces that turn the MVP into a daily product.

#### F1. Live bank & accounting connections
- Plaid (US/Canada/UK/EU) — link, daily sync, transaction normalization into the existing `transactions` table.
- QuickBooks Online + Xero — pull invoices, customers, and chart of accounts. Map to internal models.
- Stripe — pull payouts, refunds, customers.
- Reconciliation view: bank transactions vs. accounting view side-by-side; missing/extra rows flagged.
- Background sync via Celery; SSE notification when sync completes.

#### F2. Receipt vault & document linking
- Upload receipts (image/PDF). Vercel Blob storage (or S3-compatible).
- OCR with OpenAI Vision: extract amount, date, merchant, line items. **Numbers extracted by the model are facts about the receipt, not derived metrics — they pass through the LLM-guardrails layer as "ingested facts" and are subject to user confirmation before they affect any metric.**
- Auto-suggest the matching transaction (by amount + date + merchant similarity); user confirms.
- Each transaction has a "Documents" tab in the record sheet.

#### F3. Multi-currency
- Per-org base currency. Per-account currency. FX rates pulled daily from a deterministic source (ECB or Open Exchange Rates), stored, never re-fetched retroactively (so historical totals don't drift).
- All metrics display in base currency with original-currency tooltip.
- Add `fx_rate_used` to every multi-currency transaction row for traceability.

#### F4. Real-time updates (SSE)
- `/events` endpoint per org. Emits typed events: `transaction.added`, `invoice.paid`, `forecast.recomputed`, `notification.created`, `import.completed`.
- Frontend connects on app shell mount; SWR cache mutations triggered on events.
- Live "X new transactions" toast that doesn't disrupt the user's flow.

#### F5. Full RBAC + team management
- Roles: `owner`, `admin`, `member`, `viewer` (new). Viewers can read everything but can't write.
- Per-resource permissions where it matters: only owners can delete the org, change billing; admins can connect/disconnect integrations; members can log touches and override categories; viewers see read-only.
- Invitations by email with magic-link sign-up.
- Member list, role changes, removal — with audit log entries.

#### F6. Insight Stream
- A unified, org-scoped feed of automatically generated insights: "Spend on SaaS is up 32% MoM", "Customer Acme is 23 days late and trending later", "Runway dropped 6 weeks due to last week's $80k spend on AWS".
- Each insight is a record with: severity, evidence_ids, deep link, status (new/snoozed/resolved/dismissed), assignee, comments.
- Generated nightly by a Celery beat job; also fired on threshold-cross events.
- Frontend: a left rail (or `/inbox` page) similar to Linear — filterable, assignable, resolvable.

#### F7. Investor share links
- One-click "share runway snapshot" — produces a public read-only URL with optional password and expiry.
- Curated view: cash balance, runway weeks, weekly forecast chart, milestones, narrative. **All numbers are frozen at share time** — link shows the data as of `shared_at`, with a "see live" prompt to authenticated viewers only.
- Org admin can revoke any link from settings.

### Tier 2 — Differentiated intelligence

The features that move us from "nice tool" to "we cannot operate without this".

#### F8. Scenario branches
- Like git branches, but for forecasts. Create a scenario ("Hire 3 engineers Q3", "Cut SaaS by 30%", "Delay raise by 6 months") that diverges from the current baseline.
- Each scenario carries a set of overrides: planned hires (with start date, salary, equity), planned cuts (commitment IDs to terminate, with effective date), planned raises (revenue boost with ramp).
- Side-by-side comparison view: scenario A vs B vs baseline, crash-week deltas highlighted.
- Promote scenario → baseline when reality confirms it.

#### F9. Vendor Intelligence
- Detected via clustering on merchant + amount + cadence:
  - Duplicate tools (e.g. paying for Notion AND Coda AND Confluence).
  - Unused subscriptions (no employee activity signal, or no charges variance for 3+ months on a tool we know is usage-priced).
  - Price hikes (>10% increase in a recurring commitment vs prior cycles).
  - Renewal in next 30 days (so the user can negotiate).
- A `/vendors` page with severity-ranked findings, each as a Tier-1 Insight Stream item.

#### F10. Customer Health Scores
- Per customer: payment-history score, lateness trend, contact recency, predicted next-payment date (using existing lateness model).
- "At-risk" auto-tag with explanation that cites the relevant invoice IDs.
- Surfaced on `/customers` and as a column on the action queue.

#### F11. Decision Engine
- A new UI surface (`/decisions`) where the user can ask "What if?" in structured form:
  - "Can we afford a $120k senior engineer starting Aug 1?"
  - "If we cut our top 5 SaaS line items, how much runway do we add?"
  - "If customer Acme pays this week vs in 30 days, what's the runway delta?"
- For each, the engine returns a deterministic answer with crash-week math, plus an LLM-narrated explanation citing the relevant evidence_ids.
- Save decisions; revisit later with "what actually happened" overlay.

#### F12. Investor Update generator
- Pulls KPIs, runway, top wins/risks, asks; generates a draft monthly investor update in the user's voice.
- LLM is bounded to the deterministic facts payload + a free-text "highlights" section the user wrote themselves.
- One-click "publish": creates a share link (F7) and renders a polished HTML email.

### Tier 4 & Tier 5 — Cutting-edge

Detailed in **`docs/CUTTING_EDGE.md`** (F16–F35). Headlines:

- **F16 Causal Analyst Agent** — multi-step LLM investigation with cited evidence per step (Anthropic Agent SDK).
- **F17 Probabilistic forecast** — Monte Carlo P10/P50/P90 cash bands.
- **F18 Semantic categorization** — pgvector + active learning; per-org embedding model.
- **F19 Time-machine** — point-in-time replay; "show me the dashboard on June 1".
- **F20 Document Intelligence Vault** — pitch deck / SAFE / term sheet extraction + dilution math.
- **F21 Live Financial Model** — spreadsheet replacement with cells bound to live data.
- **F22 Treasury & card controls** — Mercury / Brex / Ramp; rule-based card guards.
- **F23 Voice Copilot** — OpenAI Realtime; hands-free during investor calls.
- **F24 Email AI** — forward-in for receipts/invoices; outbound drafts with cited data.
- **F25 Knowledge graph** — explore vendor/customer/employee relationships.
- **F26 Investor matcher** — embeddings-based targeting with evidence-backed scoring.
- **F27 Capital efficiency dashboard** — Rule of 40, Burn Multiple, CAC payback, etc.
- **F28 Vendor negotiation pack** — auto-assembled at renewal time.
- **F29 Slack-native approvals** — every dangerous action gated by Slack approval.
- **F30 Public benchmark network** (opt-in) — anonymized peer comparison.
- **F31 Template marketplace** — investor-update and model templates.
- **F32 Vercel Sandbox** — power-user Python notebooks against live data.
- **F33 Federated reporting** — investor portfolio view via explicit grants.
- **F34 Cryptographic audit exports** — Ed25519-signed packages.
- **F35 Browser extension** — auto-detect SaaS subscriptions from billing pages.

### Tier 3 — Platform

#### F13. Integrations marketplace
- Outbound: Slack (daily digest, alerts, mentions), Linear (create issue from insight), Notion (export reports), Email (digests, share notifications), Webhooks.
- Inbound: in addition to F1, support pushing data via API keys.
- Settings → Integrations page with connect/disconnect cards and per-integration config.

#### F14. API & webhooks
- Personal access tokens (PAT) and org-scoped service tokens.
- Public REST API mirroring the internal routers, documented at `/api/v1` with OpenAPI.
- Webhook subscriptions on the same event types as F4.

#### F15. Mobile-first PWA
- Installable PWA with offline-tolerant cache for the dashboard, runway, and inbox pages.
- Touch-first navigation (bottom tab bar on mobile, retain side nav on tablet+).
- Push notifications via Web Push (for users who opt in).

---

## Out of scope (explicitly)

- Bookkeeping (we read accounting data, we don't replace QuickBooks).
- Tax filing (we estimate impact, we don't file).
- Payments / paying invoices on behalf of the user (out of scope until we're audited).
- AI agents that take destructive actions without a human in the loop (deletions, money movement, external sends). The LLM proposes; the human approves.

## Success criteria per tier

A tier is "done" when:

- Every feature in it ships with a passing test suite and a user-visible empty state, loading state, and error state.
- Every numeric output has a "show evidence" affordance.
- The frontend works at 320px width and at 1920px width.
- The backend p95 for any read endpoint is under 300ms on seed data.
- A new user can register, connect a bank (F1, Tier 1+), and reach the dashboard with real data in under 5 minutes.
