# Phase 1.D — Per-Page Polish

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use `- [ ]`.

**Goal:** every existing surface looks done. Loading skeletons that match the final layout, empty states with action CTAs, error states that show a request-id, EvidenceChips on every numeric figure, inline edit on small forms, keyboard navigation per `docs/DESIGN_SYSTEM.md`, Recharts wired to the new oklch tokens.

**Architecture:** five sub-workstreams, one per page family — Dashboard, Spending (+ Transactions / Rules / Commitments), Invoices (+ List / Actions / Customers / Imports), Runway, Funding. Each is independent and can be a separate subagent.

**Tech Stack:** existing pages; new finance primitives from 0.C; `<DataTable>` from 0.D; `EvidenceChip`, `Money`, `MetricCard` already shipped.

**Dependencies:** 1.A merged (audit log helper for write actions); 1.C ideally merged for the bell in top bar (otherwise 1.D won't conflict with 1.C — they touch top-bar in different ways).

**Skills:** `foundershq-conventions`, `frontend-design:frontend-design`, `vercel:nextjs`, `vercel:shadcn`, `vercel:next-cache-components`.

---

## Sub-workstreams (independent — dispatch as 5 parallel subagents)

### 1.D.1 — Dashboard

Files: `frontend/app/(shell)/dashboard/page.tsx`, `frontend/components/dashboard/*`.

- Replace bespoke metric tiles with `<MetricCard>` from 0.C.
- Health Score breakdown: progress bars with `--accent` for value ≥ 80, `--warn` for 60–79, `--danger` below 60.
- Charts: replace inline chart colors with `var(--accent)` / `var(--danger)` / `var(--ink-3)`.
- Loading skeleton matches MetricCard footprint (no layout shift).
- Empty state with two CTAs: "Connect a bank" → `/integrations`, "Seed sample data" → `/onboarding?step=3`.
- Error state shows `request_id` from response header.

### 1.D.2 — Spending (Transactions / Rules / Commitments)

Files: `frontend/app/(shell)/spending/*/page.tsx`, `frontend/components/spending/*`.

- Transactions table → `<DataTable>`; columns: date, merchant, amount (Money), category (inline edit via existing dropdown).
- Empty filter ≠ no data: distinct messages.
- Keyboard: `/` to filter, `j`/`k` to navigate, Enter to open.
- Categorization rules: inline create form (already there) with `react-hook-form` + zod; toast on save.
- Commitments: list + per-row enable toggle.

### 1.D.3 — Invoices (List / Actions / Customers / Imports)

Files: `frontend/app/(shell)/invoices/*/page.tsx`, `frontend/components/invoices/*`.

- List → `<DataTable>` with sticky first column.
- Actions: action-queue list with the Touch log inline-create modal.
- Customers: per-customer page renders invoices + lifetime + lateness fingerprint.
- Imports: existing wizard; add request-id on error states.

### 1.D.4 — Runway

Files: `frontend/app/(shell)/runway/page.tsx`, `frontend/components/runway/*`.

- Forecast chart with new tokens; tooltip shows `evidence_ids.length` as "N sources" linking to the RecordSheet stack.
- Scenario panel: inline edit on milestones via react-hook-form.
- Crash-week badge: `<DeltaBadge>` style.
- Empty: "Set your starting cash and recurring inflows" CTA → onboarding step 1 deep-link.

### 1.D.5 — Funding

Files: `frontend/app/(shell)/funding/page.tsx`, `frontend/components/funding/*`.

- Route cards as `<MetricCard density="expanded">`.
- Opportunity table → `<DataTable>`; save-action inline.
- Improvement checklist with progress + per-item evidence chips.

---

## Hard rules (apply to every sub-workstream)

- No new dependencies.
- Every numeric figure on screen is either a `<Money>` or a `<DeltaBadge>`.
- Every causal explanation surface uses `<EvidenceChip>`.
- Every page renders **three** states: skeleton (matches final layout), empty (named CTA), error (with request_id).
- Inline edits use `react-hook-form` + `zod`; submit-on-blur.
- Charts call `var(--accent)` etc.; no hard-coded hex.
- Keyboard: `j`/`k` on lists; `Esc` closes sheets; `/` focuses filter inputs.

## Definition of done

- All five page families render at 320 / 768 / 1440 px without layout shift (Playwright resize checks).
- `pnpm verify` clean.
- Lighthouse mobile dashboard ≥ 90 (gate from FEATURE_ROADMAP phase 1).
- All Playwright happy-path tests for each surface pass.

## Out of scope

- Tier-2 features (scenario branches, decision engine, etc.) — phase 3.
- LLM Copilot side panel — phase 3.E.
- New chart types beyond what already exists.
