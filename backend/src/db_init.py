from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Base
from .config import DATABASE_URL


engine = create_async_engine(
    url=DATABASE_URL,
)

async_session = async_sessionmaker(
    engine, expire_on_commit=False
)

async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session