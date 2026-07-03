# FoundersHQ

A financial operating system for early-stage startups. It imports transaction and invoice data, computes spend, burn, runway and funding signals and uses an LLM only to explain those numbers with cited evidence rather than to invent them.

## Context

Built for a fintech hackathon run with DE Shaw and Capital One. It placed in the top 5 out of more than 150 participants.

The product is designed around one constraint: financial numbers should be deterministic and auditable and AI should cite its evidence instead of generating values. That constraint drove most of the engineering decisions in this repository.

## The three invariants

These are product rules enforced in code, not aspirations. They shaped the architecture.

1. **Determinism.** Every number on screen re-derives from stored rows. Financial math uses Python `Decimal` server-side and a `<Money>` component client-side. There are no LLM-generated numbers.
2. **Evidence.** Any causal claim returns a list of `evidence_ids` that point to specific transaction or invoice records. The frontend resolves them into clickable chips that open the underlying record.
3. **Audit.** Every mutation writes an audit-log row through a single `record_audit` helper. Every LLM call writes a row that stores a hash of the facts the model was given.

If a feature could not satisfy these, it was redesigned.

## What is implemented

Backend and frontend for the following product surfaces:

- **Spending Health.** Recurring-commitment detection, vendor analysis, net burn, run rate and spend-creep signals.
- **Invoice Control.** Invoice tracking, customer behaviour, an action queue and follow-up (touch) logging.
- **Runway Radar.** Weekly cash forecasts with base and pessimistic scenarios, plus attribution back to the transactions and invoices that drive each week.
- **Funding Fit.** Route ranking, opportunity storage and improvement recommendations.
- **Insight Stream.** Deterministic generators (cash drop, late invoice, vendor spike, commitment renewal, runway change) that produce evidence-linked insights, deduplicated by a hash of their evidence set.
- **Notifications and Inbox.** A notification bell with unread counts, a snooze flow and per-type preferences.
- **Onboarding.** A multi-step wizard with a deterministic seed path.
- **Auth, RBAC and team management.** Registration, login, password reset, magic-link invitations and role changes.
- **Audit log.** A filterable audit view with streaming CSV export.
- **Global search.** Cross-entity lookup wired to a Cmd-K command palette.
- **Multi-currency.** An FX-rate table, a base-currency context and dual-render money components.

## Architecture

The system separates a deterministic core from an LLM periphery.

- **Deterministic core.** Every file under `app/services/<domain>/` is pure Python with typed inputs and outputs. Routers stay thin: they fetch rows, call a service, serialise the result, write an audit entry and publish an event. This keeps metrics fast to test and reproducible.
- **LLM periphery.** The LLM lives only under `app/services/llm/` and its routes. Every call passes through `validate_llm_response`, which rejects any number that is not present in the facts payload and any causal claim without a record citation.
- **Multi-tenancy.** A `CurrentOrg` dependency is injected into every route and a SQLAlchemy event listener asserts that org-scoped inserts carry an `org_id`. The backend is the security boundary. Frontend role checks are for UX only.
- **Real-time.** Mutations publish events to a durable outbox table and to Redis pub/sub. A server-sent-events endpoint streams them per org and the client reconnects with catch-up from the outbox.

### How the invariants show up in the code

- Financial math uses `Decimal` across the service layer instead of floats, so results are exact and reproducible.
- Service functions that surface a derived insight return `evidence_ids` alongside the values and the router passes them through to the response schema.
- Mutations route through `record_audit` and LLM calls persist a `facts_hash` so it is possible to prove exactly what the model saw.
- Roles are `owner`, `admin`, `member` and `viewer`, gated by a `requires_role` dependency on mutation routes.

## Tech stack

**Backend:** FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic v2, Celery with Redis, python-jose for JWT (HS256) and passlib with bcrypt. The OpenAI SDK is used for explanation and drafting only, validated against server-provided facts.

**Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Radix primitives, SWR for data fetching, Recharts for charts and Zod for validation.

**Infrastructure:** PostgreSQL 15 and Redis 7 via Docker Compose, with three GitHub Actions workflows for the backend, the frontend and dependency security.

## By the numbers

- 18 SQLAlchemy models, 15 service domains, 18 API routers and 10 Alembic migrations.
- 117 backend tests across 37 test modules.
- 26 frontend routes and 99 React components across 13 domains.
- Roughly 10.5k lines of backend application code and 20.6k lines of frontend code.

## Repository structure

```text
.
├── backend/    FastAPI app: models, services, routers, tasks and tests
├── frontend/   Next.js app: routes, components, typed API layer and hooks
├── docs/       Architecture, design system, product spec and security notes
├── docker-compose.yml   Local Postgres and Redis
└── README.md
```

The frontend API layer is hand-written: typed DTOs, mappers from API shapes to view models, SWR query hooks and a mock-data mode so the UI runs without a backend.

## Running locally

Prerequisites: Docker, Python 3.11+, Node 18+ and pnpm.

Start infrastructure:

```bash
docker compose up -d db redis
```

Backend:

```bash
cd backend
cp .env.example .env
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
```

The API and its OpenAPI docs are at `http://localhost:8000/docs`. To seed sample data run `python -m app.scripts.seed_dev_data` and to run background jobs start a worker with `celery -A app.tasks.celery_app worker --loglevel=info`.

Frontend:

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

The app runs at `http://localhost:3000`. It defaults to mock mode. To hit the real backend, set:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_MOCK_API=false
```

## Verification

Backend (ruff, mypy and pytest):

```bash
cd backend
make verify
```

Frontend (tsc and eslint):

```bash
cd frontend
pnpm verify
pnpm build
```

## Design docs

`docs/` holds the design documents written for the project: architecture, the design system, the product specification and the security model. They describe the full intended product, which is larger than what is implemented here. Each starts with a note marking that distinction.

## Scope and limitations

- This is a hackathon and MVP codebase, not a production financial system.
- The forecasts are planning tools, not accounting advice.
- Several integrations described in the design docs, including bank sync, accounting sync and receipt OCR, are specified but not built.
