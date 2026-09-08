# FoundersHQ API

FastAPI application, SQLAlchemy models, Alembic migrations and deterministic financial services.
See the [project README](../README.md) for architecture, setup, examples and known limits.

From this directory, install with `pip install -e ".[dev]"`, copy `.env.example` to `.env`,
start PostgreSQL/Redis, run `alembic upgrade head`, then `uvicorn app.main:app --reload`.
`make verify` runs lint, configured type checks and tests without infrastructure.
`make test-integration` additionally needs the configured PostgreSQL and Redis services.
