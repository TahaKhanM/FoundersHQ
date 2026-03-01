"""Application configuration from environment."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """App settings; load from env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "FoundersHQ"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://foundershq:foundershq@db:5432/foundershq"
    database_url_sync: str = "postgresql://foundershq:foundershq@db:5432/foundershq"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # JWT
    secret_key: str = "change-me-in-production-use-env"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24h

    # Celery
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # LLM (optional)
    openai_api_key: str | None = None
    llm_guardrail_reject_on_unknown_numbers: bool = True

    # Ingest
    parse_confidence_threshold: float = 0.85

    # Spend creep alert
    spend_creep_alert_threshold: float = 0.25

    # Action queue: invoice considered "touched" (completed) if last touch within N days
    action_queue_completion_days: int = 7


@lru_cache
def get_settings() -> Settings:
    return Settings()
