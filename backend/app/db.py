from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from .config import settings

client: AsyncMongoClient = AsyncMongoClient(settings.mongodb_uri, tz_aware=False)


def get_db() -> AsyncDatabase:
    return client[settings.mongodb_database]


async def init_db() -> None:
    db = get_db()
    await db.events.create_index("start")
    await db.events.create_index("organisation")

    if await db.colleagues.count_documents({}) == 0:
        await db.colleagues.insert_many(
            [{"name": f"colleague{i}", "active": True} for i in range(1, settings.colleague_seed_count + 1)]
        )
