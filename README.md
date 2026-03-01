# FoundersHQ Backend

FastAPI backend for **FoundersHQ** with deterministic computation engines and strict LLM guardrails.

## Full-stack run (stabilization checklist)

Use these steps to run the app end-to-end with real data (`NEXT_PUBLIC_MOCK_API=false`).

1. **Start DB and Redis** (from repo root)
   ```bash
   docker compose up -d db redis
   ```

2. **Backend: migrations**
   ```bash
   cd backend
   cp .env.example .env   # edit if needed: DATABASE_URL, REDIS_URL, CELERY_* to localhost when running outside Docker
   alembic upgrade head
   ```

3. **Backend: seed (optional, after at least one org exists)**
   ```bash
   python -m app.scripts.seed_dev_data
   # or: python -m scripts.seed_dev_data
   ```

4. **Backend: API server**
   ```bash
   uvicorn app.main:app --reload
   ```
   API: http://localhost:8000

5. **Backend: Celery worker** (separate terminal)
   ```bash
   cd backend
   celery -A app.tasks.celery_app worker --loglevel=info
   ```
   Use `REDIS_URL=CELERY_BROKER_URL=redis://localhost:6379/...` in `.env` when running worker on host.

6. **Frontend**
   ```bash
   cd frontend
   cp .env.example .env.local
   # Set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 and NEXT_PUBLIC_MOCK_API=false for real API
   pnpm install && pnpm dev
   ```
   App: http://localhost:3000

**Smoke tests (real API):**
- Global search: query "runway" → Runway page; query an invoice/transaction id → opens correct sheet.
- Action queue: severity grouping, log touch persists after refresh.
- Invoices tabs stay visible when switching between /invoices, /invoices/list, /invoices/actions.
- Weekly outflow chart shows data or "No data for selected period."
- RecordSheet loads real transaction/invoice when opening from search or alerts.

---

- **FastAPI** – REST API (OpenAPI at `/docs`)
- **PostgreSQL** – primary store
- **SQLAlchemy 2** (async) + **Alembic** – ORM and migrations
- **Celery** + **Redis** – background jobs (imports, recompute)
- **Pydantic** – request/response DTOs

## Global constraints

- All numeric computations are **deterministic** and reproducible from stored data.
- **LLM** is used only for explanations, summaries, and drafting; it must **never** invent numbers.
- Any explanation claiming a cause must **cite evidence IDs** (transaction/invoice IDs).
- **Multi-tenant isolation**: every core record has `org_id`; all queries are org-scoped.

## Quick start (Docker)

```bash
cd backend
docker compose up --build
```

Then in another terminal:

```bash
# Run migrations
docker compose exec api alembic upgrade head

# Seed dev data (after registering a user so an org exists)
docker compose exec api python -m scripts.seed_dev_data
```

- **API**: http://localhost:8000  
- **OpenAPI docs**: http://localhost:8000/docs  

## Local dev (no Docker)

1. Create a PostgreSQL database and a Redis instance.
2. Copy `.env.example` to `.env` and set:
   - `DATABASE_URL` / `DATABASE_URL_SYNC`
   - `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`
   - `SECRET_KEY`
3. Install and run:

```bash
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

In a separate terminal, run the Celery worker:

```bash
celery -A app.tasks.celery_app worker --loglevel=info
```

Seed dev data (after at least one org exists, e.g. after register):

```bash
python -m scripts.seed_dev_data
```

## Run tests

```bash
pytest
# or with coverage
pytest --cov=app
```

Tests include:

- `test_metrics.py` – spending formulas (TotalOutflow, NetBurn, RunRate, SpendCreep, CashWeeks, BufferRatio)
- `test_commitments.py` – recurring detection from synthetic txns
- `test_invoice_predictions.py` – lateness fingerprint and expected pay dates
- `test_runway_forecast.py` – weekly simulation, crash week
- `test_funding_scoring.py` – deterministic scoring and rule firing
- `test_api_contracts.py` – smoke tests for key endpoints and DTO shapes

## Main API areas

- **Auth** – `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- **Org** – `GET /org`, `DELETE /org/data` (with confirm)
- **Ingest** – CSV transactions/invoices, questionnaire, `POST /ingest/sample-seed`
- **Spending** – metrics, transactions, categories, rules, commitments, alerts
- **Invoices** – overview, list, detail, customers, action-queue, touches, templates, parsing jobs
- **Runway** – `POST /runway/forecast/compute`, scenarios, milestones, attribution
- **Funding** – routes rank, opportunities, save, timeline, improvements
- **LLM** – `POST /llm/explain`, `POST /llm/draft-collection-message` (guardrails: no invented numbers, citations)
- **Integrations** – `POST /integrations/funding/opportunities`, `POST /integrations/invoices/parsed` (no scrapers built)

## Integration endpoints (no scrapers)

- **Funding**: `POST /integrations/funding/opportunities` – accept JSON batch of opportunities; validate, upsert, version.
- **Invoice parsing**: `POST /integrations/invoices/parsed` – accept extracted fields + confidence; if below threshold or missing required fields, mark `needs_review`. Review: `GET /invoices/parsing/jobs/{job_id}`, `POST /invoices/parsing/jobs/{job_id}/confirm`.

## Secrets

Use environment variables; never commit secrets. Required:

- `SECRET_KEY` – JWT signing
- `DATABASE_URL` / `DATABASE_URL_SYNC`
- `OPENAI_API_KEY` – optional, for LLM explain/draft
