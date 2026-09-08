# FoundersHQ

A startup financial-planning application with a FastAPI backend and Next.js dashboard. It turns transactions and invoices into cash-flow forecasts, spending breakdowns and collection priorities. Calculations use Decimal arithmetic and retain the records behind each forecast.

The backend handles organisation access, financial calculations and audit records. The frontend provides onboarding, invoice management and scenario screens, including a mock mode for exploring the interface without running the services.

## Engineering work

| Area | Implementation |
| --- | --- |
| Cash forecasting | [History baseline](backend/app/services/runway/history.py) and [cash simulation](backend/app/services/runway/forecast.py) use eight complete weeks of transactions, include inactive weeks and exclude future records. |
| Organisation access | [Request dependencies](backend/app/deps.py) and [membership routes](backend/app/api/routers/org.py) enforce tenant boundaries and member roles. Ownership changes lock the organisation row in PostgreSQL. |
| Invoice workflow | [Invoice services](backend/app/services/invoices) track payment status, collection priorities and follow-up actions. |
| Explanation checks | [Guardrails](backend/app/services/llm/guardrails.py) check optional model explanations against supplied numbers and record IDs. The financial services calculate the figures. |
| API integration | The [frontend API layer](frontend/lib/api) uses typed models and SWR. Decimal values arrive as strings to preserve precision. |

## Forecast design

The model starts from recorded cash and repeats the mean weekly receipts and payments over a chosen horizon. Users can change either flow with a multiplier. Each week applies `ending = starting + receipts - payments`; the first negative ending balance is the crash week, indexed from zero.

For example, £220 of cash and £800 of payments over eight complete weeks give a £100 weekly outflow. Cash first becomes negative in week index 2. The stress case reduces receipts by 20% and raises payments by 20%, moving that point to week index 1.

Stored forecasts retain input record IDs, the cash-profile timestamp and the method version. Invoice totals are kept separate from transaction receipts to avoid double counting. Mixed currencies are rejected until conversion provenance is supported across every aggregate.

This is a planning baseline. It does not fit seasonality or predict hiring and payment delays. The stress case is a sensitivity calculation rather than a confidence interval.

## Run locally

Use Python 3.11+, Node.js 24+, pnpm 10.30.3 and Docker for PostgreSQL/Redis.

For the complete local backend stack:

```sh
docker compose up --build -d
# API migrations run before the server starts.
# Open http://localhost:8000/docs
```

For backend development on the host:

```sh
docker compose up -d db redis
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -e '.[dev]'
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

The committed requirements pin the resolved runtime dependencies. Regenerate them
with `uv pip compile --python-version 3.11 pyproject.toml -o requirements.txt` from
`backend` after a deliberate dependency change.

Register an account through the UI or API before importing data. To create the
synthetic developer dataset:

```sh
cd backend
source .venv/bin/activate
python -m app.scripts.seed_dev_data
# Optional host worker for CSV imports:
celery -A app.tasks.celery_app worker --loglevel=info
```

The seed command can create a developer account with printed local credentials.
Use it only in a disposable development database.

Start the frontend in a separate terminal:

```sh
cd frontend
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. Mock mode is enabled by default so the interface can be
explored without services. Set `NEXT_PUBLIC_MOCK_API=false` and
`NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` to use the real API. Mock-screen
numbers are demonstration data, not measured project results.

For a real forecast, first submit a cash profile to `POST /ingest/questionnaire`,
import transaction history and call `POST /runway/forecast/compute` with, for example:

```json
{
  "horizon_weeks": 26,
  "scenario_params": { "outflows_multiplier": 1.1, "inflows_multiplier": 0.9 }
}
```

Use the bearer token returned by `/auth/register` or `/auth/login` in the OpenAPI
Authorize dialog. Validation errors explain which input is missing.

## Verify

```sh
cd backend
make verify                 # ruff, configured mypy checks, non-infrastructure tests
make test-integration       # needs PostgreSQL and Redis
cd ../frontend
pnpm verify                 # TypeScript and ESLint
pnpm build
pnpm audit --prod
```

Regression tests cover malformed credentials, role escalation, read/write tenant
boundaries, token reuse, exact financial examples, future-data exclusion,
zero-valued scenarios and persisted forecast reads. Several legacy modules remain outside the mypy checks.
The dependency audit workflow fails on findings instead of suppressing its exit code.

## Status and project history

FoundersHQ began as a fintech hackathon project associated with D. E. Shaw and Capital One. The [original team write-up](https://github.com/TahaKhanM/FoundersHQ/blob/6e74bec8cbcdb28e1403fa309e31538ecd7b6c07/README.md#context) records a top-five finish among more than 150 participants. The repository includes subsequent backend and frontend development.

The prototype still needs bank integrations, reliable email delivery, session revocation and complete multi-currency reporting. Some events use an in-process queue, so delivery across workers is unfinished. Public authentication also needs abuse controls before deployment. Model explanation checks establish numeric consistency but cannot establish whether a citation supports a claim.

[Architecture](docs/ARCHITECTURE.md) · [Backend tests](backend/tests) · [CI workflows](.github/workflows)
