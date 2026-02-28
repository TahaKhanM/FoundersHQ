"""Seed dev/demo data - CLI entry. Run from backend: python -m scripts.seed_dev_data"""
import asyncio
from app.config import get_settings
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.models import org
from app.scripts.seed_dev_data import seed_org


def main():
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _run():
        async with async_session() as session:
            result = await session.execute(select(org.Org).limit(1))
            o = result.scalar_one_or_none()
            if o:
                await seed_org(session, o.id)
                print(f"Seeded org {o.id}")
            else:
                print("No org found. Register a user first.")

    asyncio.run(_run())


if __name__ == "__main__":
    main()
