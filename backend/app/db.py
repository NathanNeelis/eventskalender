from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from .config import settings

client: AsyncMongoClient = AsyncMongoClient(settings.mongodb_uri, tz_aware=False)

COLLECTIONS = ("events", "colleagues")


def get_db() -> AsyncDatabase:
    return client[settings.mongodb_database]


async def init_db() -> None:
    db = get_db()
    existing = set(await db.list_collection_names())
    for name in COLLECTIONS:
        if name not in existing:
            await db.create_collection(name)

    await db.events.create_index("start")
    await db.events.create_index("organisation")
    await db.events.create_index("attendee_ids")
