"""FoundersHQ FastAPI application."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.routers import auth, org, ingest, spending, invoices, runway, funding, llm, customers, integrations, search, notifications, dashboard

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title=settings.app_name,
    description="Backend API for FoundersHQ with deterministic computation and LLM guardrails",
    version="0.1.0",
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(org.router, prefix="/org", tags=["org"])
app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
app.include_router(spending.router, prefix="/spending", tags=["spending"])
app.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
app.include_router(runway.router, prefix="/runway", tags=["runway"])
app.include_router(funding.router, prefix="/funding", tags=["funding"])
app.include_router(llm.router, prefix="/llm", tags=["llm"])
app.include_router(customers.router, prefix="/customers", tags=["customers"])
app.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
app.include_router(search.router, prefix="/search", tags=["search"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])


@app.get("/health")
async def health():
    return {"status": "ok"}
