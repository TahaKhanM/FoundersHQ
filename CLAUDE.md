# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What we are building

**FoundersHQ — the CFO co-pilot that never lies.** A financial operating system for early-stage startups where every number on screen is reproducible from raw rows, every AI claim cites its receipts, and every action is audit-logged. Read these documents before any non-trivial work:

- `docs/PRODUCT_SPEC.md` — vision, personas, complete feature inventory (Tiers 0–5).
- `docs/CUTTING_EDGE.md` — detailed specs for Tier 4 & 5 (multi-agent analyst, probabilistic forecast, time-machine, voice, financial model, etc.).
- `docs/ARCHITECTURE.md` — current and target system shape, where new modules go.
- `docs/DESIGN_SYSTEM.md` — voice, tokens, components, patterns. Read before opening any TSX file.
- `docs/SECURITY.md` — threat model, isolation, audit, secrets.
- `docs/FEATURE_ROADMAP.md` — phased build plan with gates (0 through 8). Do not skip phases.

The autonomous build is driven by the `/execute-v2` slash command (defined in `.claude/commands/execute-v2.md`). `BUILD_PROMPT.md` is the human-readable equivalent for paste-in use.

## The three invariants

These are product rules, not engineering rules. They constrain the design space:

1. **Determinism.** Every number on screen must re-derive from rows. No LLM-generated numbers, no silent randomness. `Decimal` server-side; `<Money>` component client-side.
2. **Evidence.** Any causal claim must return `evidence_ids: list[str]` of transaction/invoice UUIDs. The frontend resolves them via `EvidenceChip` and `RecordSheet`.
3. **Audit.** Every mutation calls `record_audit(...)`. Every LLM call writes an `llm_calls` row with `facts_hash`. No exceptions.

If a feature would violate one of these, redesign the feature.

## Skills to use (and when)

The `Skill` tool is how you load workflows. Use them deliberately:

| Skill | When |
|---|---|
| `foundershq-conventions` | Any code task in this repo. Load this first when in doubt. |
| `deterministic-finance` | Adding or changing a metric, forecast, score. |
| `evidence-linked-llm` | Any feature that calls an LLM. |
| `multi-agent-orchestration` | Building multi-step server-side agents (Phase 6+). |
| `realtime-and-streaming` | Building SSE, Redis pub/sub, durable workflow, or streamed LLM flows. |
| `superpowers:brainstorming` | Before designing a non-trivial feature. Do not skip. |
| `superpowers:writing-plans` | Once a design is agreed, before writing code. |
| `superpowers:test-driven-development` | Every feature and every bugfix. |
| `superpowers:executing-plans` | When working through a written plan with checkpoints. |
| `superpowers:dispatching-parallel-agents` | When a phase has independent workstreams (most do). |
| `superpowers:subagent-driven-development` | When dispatching multi-task implementation. |
| `superpowers:verification-before-completion` | Before claiming any workstream done. |
| `superpowers:systematic-debugging` | Any test failure or unexpected behavior. |
| `superpowers:requesting-code-review` | Before merging anything Tier-2 or larger. |
| `frontend-design:frontend-design` | Building new UI surfaces. Pair with `docs/DESIGN_SYSTEM.md`. |
| `vercel:nextjs` | App Router questions, server components, server actions. |
| `vercel:next-cache-components` | Caching strategy for the dashboard and runway pages. |
| `vercel:shadcn` | Adding or composing shadcn components. |
| `vercel:ai-sdk` | When implementing the Copilot side panel and any streaming AI feature. |
| `vercel:vercel-storage` | Configuring Blob for receipts. |
| `vercel:auth` | If we move auth to Clerk; default plan is to keep JWT + RBAC. |
| `vercel:workflow` | Durable workflows for Plaid sync and OCR pipelines. |

The MCP `playwright` tools are available — use them for E2E test runs and for verifying UI changes before declaring work complete.

## Repo shape

```
backend/   FastAPI + SQLAlchemy 2 async + Alembic + Celery + Pydantic v2
frontend/  Next.js 16 App Router + React 19 + Tailwind v4 + shadcn/ui
docs/      Product, architecture, design system, roadmap
.claude/   Project-specific skills and settings (local)
docker-compose.yml  Postgres 15 + Redis 7 for local dev
BUILD_PROMPT.md     The single autonomous-build entry prompt
```

## Common commands

### Backend (`cd backend`)

```bash
# Setup
cp .env.example .env
alembic upgrade head

# Run
uvicorn app.main:app --reload                                      # API on :8000
celery -A app.tasks.celery_app worker --loglevel=info              # worker (new terminal)
celery -A app.tasks.celery_app beat --loglevel=info                # scheduler (Tier 2+)
python -m scripts.seed_dev_data                                    # seed (after one org exists)

# Test
pytest                                                              # all
pytest tests/test_runway_forecast.py                                # one file
pytest tests/test_runway_forecast.py::test_crash_week               # one test
pytest -k guardrail                                                 # by keyword

# Migrate
alembic revision -m "describe change" --autogenerate
alembic upgrade head

# Quality (add in phase 0)
ruff check .
mypy app
make verify   # runs ruff + mypy + pytest
```

`.env` defaults to host-network URLs (localhost). Use docker-network URLs only when the API runs inside `docker compose`.

### Frontend (`cd frontend`)

```bash
cp .env.example .env.local
pnpm install
pnpm dev                                                            # :3000
pnpm build
pnpm lint
pnpm verify   # add in phase 0: tsc --noEmit + eslint + lint-staged
```

Mock mode default is `true`. Set `NEXT_PUBLIC_MOCK_API=false` to hit the real backend.

**Important:** `next.config.mjs` currently sets `typescript.ignoreBuildErrors: true`. Phase 0 turns this off. Until then, `pnpm build` does NOT catch type errors — run `tsc --noEmit` separately.

### Infra

```bash
docker compose up -d db redis        # services only (recommended)
docker compose up -d                  # full stack
```

## Architecture in 60 seconds

- **Deterministic core, LLM periphery.** `app/services/<domain>/*.py` are pure Python with typed inputs and outputs. Routers are thin: fetch rows → call service → serialize → audit → publish event.
- **Multi-tenant via `CurrentOrg`.** Injected in every route. Backend is the boundary; frontend role checks are UX only.
- **Evidence flows end-to-end.** Service returns `evidence_ids`; router passes through; frontend renders `EvidenceChip`s; user clicks to open `RecordSheet`.
- **LLM guardrails are non-negotiable.** Every LLM call goes through `validate_llm_response`. See `app/services/llm/guardrails.py` and the `evidence-linked-llm` skill.
- **Real-time via SSE** (phase 0 lays pipes, phase 2 wires emitters). Redis pub/sub + durable outbox for catch-up.

## When adding a new feature

1. Confirm which Roadmap phase it belongs to. If it doesn't, you're scope-creeping.
2. Load `foundershq-conventions`. Load `deterministic-finance` if it's a metric or `evidence-linked-llm` if it's LLM.
3. `superpowers:brainstorming` to align on design.
4. `superpowers:writing-plans` to produce a plan.
5. Backend stack: model → migration → service → schema → router → mount → test.
6. Frontend stack: type → mapper → hook → page → empty/loading/error states.
7. Add audit log entries for every mutation.
8. Add Playwright tests for the happy path.
9. `superpowers:verification-before-completion` before claiming done.

## Quality bar (every phase)

- Every router mutation writes an audit log entry.
- Every LLM call routes through `validate_llm_response`.
- Every list endpoint cursor-paginates.
- Every page renders three states: loading skeleton, empty with CTA, error with request-id.
- Backend unit tests for every service function. Contract tests at the router level. Playwright tests for every Tier-1 user flow.
- Zero `any` types in new TypeScript. Zero `# type: ignore` in new Python.

## Things that will burn you if you don't know

- New SQLAlchemy model files must be added to the `from app.models import ...` line in `alembic/env.py` or autogenerate silently misses their tables.
- `CurrentOrg` resolves to the user's **first (oldest)** membership in the MVP. RBAC middleware in phase 1 replaces this with the active org from a session cookie.
- The DB session dependency commits on successful exit and rolls back on exception. Do not call `session.commit()` inside a route handler.
- `next.config.mjs` ignores TS build errors. Phase 0 turns this off; until then, `tsc --noEmit` is the truth.
- The frontend defaults to mock mode. Set `NEXT_PUBLIC_MOCK_API=false` exactly (not just unset) to hit the real backend.
- `apiFetch` is not callable in mock mode — go through hooks.
- Dates inside services are passed in, not read from the clock. Tests pin them; routers default them.

## Where to find what

| You want to know | Look here |
|---|---|
| The full feature list | `docs/PRODUCT_SPEC.md` |
| Where a new module belongs | `docs/ARCHITECTURE.md` |
| What a button or chart should look like | `docs/DESIGN_SYSTEM.md` |
| What to build next | `docs/FEATURE_ROADMAP.md` |
| Project invariants and layer order | `.claude/skills/foundershq-conventions/SKILL.md` |
| Patterns for metrics | `.claude/skills/deterministic-finance/SKILL.md` |
| Patterns for LLM features | `.claude/skills/evidence-linked-llm/SKILL.md` |
| How to start the autonomous build | `BUILD_PROMPT.md` |
