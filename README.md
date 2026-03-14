# FoundersHQ

FoundersHQ is a deterministic financial health app for startups. It turns transaction and invoice data into clear metrics, forecasts and actions. It uses AI only to explain results using a facts payload and it cites the exact records for any causal claim.

## Why this exists

Founders often need answers like:

- How long is our runway
- What can we safely spend this week
- Which invoices should we chase first
- What funding routes fit our situation

Many tools either feel manual or use AI in a way that can make up numbers. FoundersHQ is designed to be reproducible and auditable.

## What it does

### 1) Spending Health
- Import transactions and detect recurring commitments
- Compute deterministic metrics like total outflow, net burn, run rate and spend creep
- Show top vendors and drivers of spend with links to transaction IDs

### 2) Invoice Control
- Track invoices and customer behaviour
- Rank follow ups in an action queue
- Log touches like email or call so the system can measure follow up discipline

### 3) Runway Radar
- Produce a weekly cash forecast and a runway timeline
- Show base and pessimistic projections
- Explain dips and rises using evidence IDs from invoices and transactions

### 4) Funding Fit Navigator
- Store grants, loans and other opportunities in a database
- Rank routes and show a recommended timeline
- Give improvement steps tied to the current financial signals

## Key engineering highlights

- Deterministic finance engine in the backend so results are reproducible from stored data
- Evidence linked explanations where every causal claim must cite transaction IDs or invoice IDs
- LLM guardrails so the model cannot invent numbers and can only explain a facts payload
- Multi tenant data model using org scoped records
- Background jobs for imports and recompute so the UI stays responsive

## Tech stack

- Frontend: Next.js App Router and TypeScript
- UI: Tailwind CSS and shadcn/ui
- Charts: Recharts
- Backend: FastAPI and Pydantic
- Data: PostgreSQL
- ORM and migrations: SQLAlchemy 2 async and Alembic
- Jobs: Celery and Redis
- AI: OpenAI API for explanation only with server side validation

## Repo layout

- `frontend/` Next.js app
- `backend/` FastAPI API
- `docker-compose.yml` Postgres and Redis for local dev

## Run locally

### Prereqs

- Docker and Docker Compose
- Node 18+ and pnpm
- Python 3.11+

### Full stack run with real data

1. Start Postgres and Redis from repo root

```bash
docker compose up -d db redis
```

2. Backend migrations

```bash
cd backend
cp .env.example .env
alembic upgrade head
```

3. Seed dev data (optional, after at least one org exists)

```bash
python -m scripts.seed_dev_data
```

4. Start API server

```bash
uvicorn app.main:app --reload
```

API: http://localhost:8000  
Docs: http://localhost:8000/docs

5. Start Celery worker in a second terminal

```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
```

6. Start frontend

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

App: http://localhost:3000

Set these in `frontend/.env.local` for real API mode:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
- `NEXT_PUBLIC_MOCK_API=false`

### Smoke tests

- Global search: query runway then open Runway page, query an invoice or transaction ID then open the correct sheet
- Action queue: severity grouping, log touch persists after refresh
- Invoices tabs stay visible when switching between routes
- Weekly outflow chart shows data or a clear empty state
- RecordSheet loads real invoice and transaction data when opened from search or alerts

## Run tests

```bash
cd backend
pytest
```

## Main API areas

- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- Ingest: CSV transactions and invoices, questionnaire, `POST /ingest/sample-seed`
- Spending: metrics, transactions, categories, rules, commitments, alerts
- Invoices: overview, list, detail, customers, action queue, touches, templates, parsing jobs
- Runway: `POST /runway/forecast/compute`, scenarios, milestones, attribution
- Funding: routes rank, opportunities, save, timeline, improvements
- LLM: `POST /llm/explain`, `POST /llm/draft-collection-message`
- Integrations: funding batch ingest and invoice parsed ingest, no scrapers included

## Guardrails and trust

- All numeric computations are deterministic and reproducible
- LLM is used only for explanations, summaries and drafting
- The LLM must never invent numbers
- Any explanation claiming a cause must cite evidence IDs and link to the underlying records

## Roadmap

- Persistent notifications with dedupe and deep links
- Global command palette search across records and pages with deterministic ranking
- Stronger invoice prediction at customer level
- Richer runway scenario controls and milestone off track detection
- Better dashboard drilldowns from charts to evidence records
