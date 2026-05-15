"""Celery app configuration."""
from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "foundershq",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.jobs"],
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_track_started=True,
    result_expires=86400,
    # Phase 2.F — nightly orchestrator fans out one task per org. Run at
    # 04:00 UTC so it follows the daily notifications job (which currently
    # has no schedule yet but will land in 2.E/3.x).
    beat_schedule={
        "run-insights-nightly": {
            "task": "app.tasks.jobs.run_insights_nightly",
            "schedule": crontab(hour=4, minute=0),
        },
    },
)
