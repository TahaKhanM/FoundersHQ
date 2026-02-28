# FoundersHQ Backend

FastAPI backend for **FoundersHQ** with deterministic computation engines and strict LLM guardrails.

## Stack

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
