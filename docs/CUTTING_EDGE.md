# FoundersHQ — Cutting-Edge Capabilities (Tier 4 & 5)

> The features that move the product from "best deterministic finance tool" to "this is what every startup wishes they had". Every feature here respects the three invariants from `CLAUDE.md` (determinism, evidence, audit). Cutting-edge does not mean cutting corners.

---

## Tier 4 — Differentiating intelligence

### F16. Causal Analyst Agent (multi-step investigation)

**What.** The user asks "why did burn rise 18% last week?" and gets back a multi-step investigation: contributors by category → new commitments detected → anomalous transactions → comparison to baseline → narrative with every claim cited.

**How.**
- Server-side multi-agent orchestration using the Anthropic Agent SDK.
- A `CausalAnalyst` agent has tools: `query_metrics`, `query_transactions`, `query_commitments`, `query_invoices`, `find_anomalies`, `compare_periods`. Every tool returns evidence_ids alongside values.
- Each step is bounded by the existing `validate_llm_response` guardrail — numbers must come from the deterministic engine, causal claims must cite UUIDs.
- The agent emits a structured "investigation log" (steps, findings, evidence) that the UI renders as an unfolding timeline.

**Why.** This is the moment where "AI helps with finance" becomes useful and trustworthy, instead of a chatbot that makes up numbers.

**Built on:** `claude-api` skill, `.claude/skills/multi-agent-orchestration/`.

---

### F17. Probabilistic forecast (Monte Carlo + confidence bands)

**What.** Beyond base/pessimistic, every forecast carries P10/P50/P90 cash bands. The runway page shows a fan chart. The user sees "95% chance you cross zero between week 22 and week 38".

**How.**
- Inputs to the simulation come straight from the deterministic engine (commitments, current cash, historical weekly variance per category).
- 10k simulations per recompute; results stored alongside the deterministic forecast in `forecast_simulations`.
- Variance estimates per category come from the last N weeks of history (and shrink toward a global prior when N is small).
- The model is fully reproducible: a stored RNG seed per simulation makes any forecast re-derivable.

**Why.** Founders ask "how confident are you?" and we should answer with math, not vibes.

---

### F18. Semantic categorization with active learning

**What.** Transactions auto-categorize using semantic similarity (not just rules). When the user overrides, the model learns immediately, per-org.

**How.**
- Postgres `pgvector` extension. Each transaction gets an embedding of `merchant + memo + amount-bucket` at ingest.
- Categorization = nearest-neighbour search in the org's labelled set + similarity-weighted vote.
- Active learning: when the user overrides, the model logs the correction; next ingest re-weights nearest neighbours toward the labelled examples.
- Confidence score on every auto-category; below threshold → "needs review" tag.

**Why.** Rules can't capture every merchant. The user shouldn't have to write 200 rules.

---

### F19. Time-machine (point-in-time replay)

**What.** "Show me the dashboard as of June 1." Every metric, every alert, every forecast.

**How.**
- Event-source the inputs (transactions, invoices, commitments, profile changes). The deterministic engine then re-runs against the as-of snapshot.
- Frontend adds a global date selector in the top bar. When set, every page recomputes from the historical state.
- Storage: existing tables stay current; an `events` table captures all mutations with timestamps. We don't duplicate state — we replay events through the same pure functions.

**Why.** Investors and auditors ask "what did you know on date X?". We can answer.

---

### F20. Document Intelligence Vault

**What.** Upload pitch decks, financial models, SAFEs, term sheets. The system extracts terms (post-money valuation, MFN, pro-rata, liquidation preference, cap, discount), computes implied dilution, and flags inconsistencies across documents.

**How.**
- OpenAI Vision + structured-output extraction with the existing `validate_llm_response` guardrails.
- A `documents` table with type taxonomy; `extracted_terms` JSONB.
- A `cap_table_view` derived from extracted terms + manual entries; dilution scenarios merge into the runway forecast as F8 scenarios.

**Why.** Founders re-read their term sheet six months later and forget what they agreed. We never forget.

---

### F21. Live Financial Model (spreadsheet replacement)

**What.** A real interactive financial model in-app. Cells. Formulas. Versions. Shareable. Cells can reference live data (`=metric("monthly_burn")`).

**How.**
- Custom grid component (`@tanstack/react-table` extended, or a purpose-built canvas grid).
- Formula engine that compiles to Python on the server for deterministic eval; cells with `metric(...)` calls bind to live values.
- Versioning: every save creates a new immutable snapshot. Compare versions side-by-side.
- Export to XLSX for legacy use; import from existing models with column mapping.

**Why.** Every founder has a spreadsheet that drifts from reality. We make the spreadsheet reality.

---

### F22. Treasury & card controls (Mercury / Brex / Ramp)

**What.** Direct integration with corp-card and treasury providers. Set card rules ("require approval for charges > $500 to vendors not on the approved list", "block any charge to known crypto exchanges"). Treasury yield suggestions for idle cash.

**How.**
- Provider integrations under `app/integrations/<provider>/` (read first; write actions behind feature flags with approval flows).
- Card rules engine evaluates incoming charges against org policy; rejections sent back to provider; Slack approval flows for borderline cases.
- Treasury suggestions: deterministic ladders based on current cash, runway, and risk tolerance. No actual money movement until the user approves in-provider.

**Why.** Spend control is where finance teams earn their keep. We do it without a finance team.

---

### F23. Voice Copilot (Realtime API)

**What.** "Hey FoundersHQ, what's our runway?" During an investor call, the user opens a side panel that listens, transcribes, and surfaces relevant data points in real time.

**How.**
- OpenAI Realtime API on the frontend (browser WebRTC).
- Voice query → STT → existing facts-payload + guardrails pipeline → TTS response.
- A "live mode" surfaces relevant numbers without explicit queries, by detecting financial keywords in transcribed audio.

**Why.** Investor calls are the worst time to fumble for a number. We make the user look prepared.

---

### F24. Email AI

**What.** Forward any invoice / receipt / payment confirmation to a unique email address (`org-xyz@in.foundershq.app`); auto-parsed and filed. Optionally, AI can draft replies to investor data requests, citing the data.

**How.**
- Inbound email via a provider (Resend, Postmark, or AWS SES); a Celery handler routes to OCR/parsing.
- Outbound drafts use the existing LLM guardrails with the user's email context as the user-question slot.

**Why.** Receipts arrive by email anyway. Why is anyone manually entering them?

---

### F25. Knowledge Graph

**What.** Every vendor, customer, employee, product, integration, document is a node. Money flows, contracts, owners, and dependencies are edges. Click any node to explore.

**How.**
- A graph view (force-directed, but with editorial layout for top entities) at `/graph`.
- Stored as relational data; rendered with `cytoscape` or `react-flow`.
- AI-suggested edges: e.g. "Slack appears to be owned by Engineering" — user confirms.

**Why.** Founders lose the map of what's connected to what. We draw it for them.

---

### F26. Investor Matcher (embeddings)

**What.** Match the org's pitch + financials against a curated investor database. Show why each match scored — sector overlap, stage fit, check size, prior portfolio similarity — with evidence.

**How.**
- Embeddings on pitch deck (extracted), one-line description, and key metrics.
- Investor profiles in a vetted database (manually curated; reject scraped data unless we own it).
- Score = weighted similarity across dimensions; the breakdown is shown in the UI; LLM narration is bounded to the breakdown facts payload.

**Why.** Outbound to investors is mostly broken because founders pitch to people who would never invest. We fix the targeting.

---

### F27. Capital Efficiency Dashboard

**What.** A first-class page showing Rule of 40, Burn Multiple, Magic Number, CAC payback, Net New ARR per FTE, runway-to-milestone ratio. Each metric deterministic; each linked to evidence.

**How.**
- Pure additions to `app/services/spending/`, `app/services/runway/`, plus a new `app/services/efficiency/`.
- Formulas documented in-code with citations to standard definitions.
- Side-by-side compare against peer percentiles (from F30 — public benchmark network — opt-in).

**Why.** The numbers boards actually ask about.

---

### F28. Vendor Negotiation Pack

**What.** A commitment renewal triggers an auto-generated negotiation pack: your usage signal, market pricing reference, similar-tool alternatives, churn leverage cues, draft negotiation email.

**How.**
- Detection: commitments with renewal date in the next 30 days.
- Pack assembled in `app/services/vendors/negotiation.py` from existing data; draft email through LLM guardrails.
- Surfaced as a Tier-2 Insight Stream item with one-click "open pack".

**Why.** Most startups don't negotiate SaaS because the prep is too much work. We do the prep.

---

### F29. Slack-Native Approvals

**What.** Dangerous actions (publishing a share link, merging a scenario into baseline, deleting an integration) require approval. The approval happens in Slack with a single click.

**How.**
- `app/integrations/slack/approvals.py`: posts a Block Kit message with Approve / Reject buttons.
- Approval token signed by org secret; consumed once.
- Frontend shows pending approvals in the user's notification inbox.

**Why.** Founders live in Slack. Approvals shouldn't pull them out.

---

## Tier 5 — Open ecosystem & power tools

### F30. Public Benchmark Network (opt-in)

**What.** Anonymized cross-startup metrics: "median seed-stage company at month 18 spends 23% on engineering payroll". Opt-in only; participating orgs see the benchmarks too.

**How.**
- A separate `benchmarks` schema; aggregations only, k-anonymity ≥ 10 per cohort.
- A weekly job submits the org's aggregates (with explicit consent).
- Privacy: no row-level data leaves the org's DB; only category-level percentages and absolute ranges with noise added.

**Why.** Every founder asks "is this normal?". We're the first product that answers honestly.

---

### F31. Template Marketplace

**What.** Public library of investor-update templates, financial models, hiring plans, scenario presets. Forkable.

**How.**
- A `templates` table with org-private and public scopes; explicit publish action.
- Versioned, with attribution.

**Why.** Founders copy each other's structures. We make that legitimate and fast.

---

### F32. Sandbox (Vercel Sandbox)

**What.** Power users can write Python scripts against their financial data, securely isolated. "I want to see weekly burn split by employee headcount over time" — write 10 lines of Python, get a chart.

**How.**
- Vercel Sandbox (Firecracker microVM) per execution.
- Read-only API token scoped to the org; outputs rendered as charts / tables.
- Audit log per execution.

**Why.** There are always questions we didn't anticipate. The sandbox is the safety valve.

---

### F33. Federated Reporting (for investors)

**What.** A separate "investor view" — investors with multiple portcos on FoundersHQ can opt-in to share data with them. Investors see an aggregate portfolio dashboard.

**How.**
- A second tenant model: investor orgs. Companies grant read access to specific investor orgs.
- Aggregations only on the investor side (no per-row access). Companies retain full control of what's shared.

**Why.** Investors want this. Building it via the company first means we don't break the "company first" trust model.

---

### F34. Cryptographic Audit Exports

**What.** "Send everything to my auditor" → produces a signed export package (CSV + JSON + summary PDF) with an Ed25519 signature that the auditor can verify against our public key.

**How.**
- Export service in `app/services/exports/`; sign with org-specific key derived from master key + org_id.
- Public verification page at `/verify-export` accepts the signature file and the package.

**Why.** Auditors love provenance. So do investors. So does future-you.

---

### F35. Browser Extension (SaaS DNA)

**What.** A Chrome/Firefox extension that watches billing-page visits and subscription emails. Auto-suggests commitments to import.

**How.**
- Extension stores a domain → "saw a checkout" record locally.
- On user demand, syncs to backend; matches against existing commitments; surfaces "you might be paying for X" suggestions.
- No automatic data submission without user click. No clipboard scraping. No page-content access beyond explicit billing-page URLs the user permits.

**Why.** SaaS is the #1 spend category we can't see clearly. The browser sees it first.

---

## What still won't happen

- Move money on the user's behalf without an explicit per-action approval flow.
- Train shared ML models on per-org data without explicit opt-in.
- Send emails on the user's behalf without preview-and-send confirmation.
- Make the AI a decision-maker. The AI suggests; the human decides.

Every cutting-edge feature respects these. If a feature you're considering wouldn't, redesign it.

---

## How these map to existing skills and SDKs

| Capability | Stack |
|---|---|
| F16 Causal Analyst | Anthropic Agent SDK (server-side), `claude-api` skill, multi-agent-orchestration skill |
| F17 Probabilistic forecast | `numpy` (already a dep) + `forecast_simulations` table; pure functions |
| F18 Semantic categorization | `pgvector` extension, OpenAI embeddings |
| F19 Time-machine | Event-sourced inputs; pure deterministic replay |
| F20 Document vault | OpenAI Vision + structured output; existing guardrails |
| F21 Financial model | Custom grid + server-side eval; new `app/services/sheets/` |
| F22 Treasury | `app/integrations/{mercury,brex,ramp}/`, approval flows |
| F23 Voice | OpenAI Realtime API on the frontend |
| F24 Email AI | Resend inbound (or Postmark), Celery handler, existing OCR pipeline |
| F25 Knowledge graph | `cytoscape` or `react-flow`; relational edges in Postgres |
| F26 Investor matcher | OpenAI embeddings, pgvector, curated investor DB |
| F27 Capital efficiency | Pure additions to deterministic services |
| F28 Vendor negotiation | Existing vendor intel + LLM guardrails |
| F29 Slack approvals | Slack Block Kit + signed approval tokens |
| F30 Benchmarks | Aggregation jobs + k-anonymity layer |
| F31 Templates | Standard CRUD + publish flag |
| F32 Sandbox | `vercel:vercel-sandbox` skill |
| F33 Federated reporting | Investor-tenant model; explicit grants |
| F34 Cryptographic exports | Ed25519 signing |
| F35 Browser extension | Manifest v3 extension; minimal-access model |
