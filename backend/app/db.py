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
    await db.events.create_index("attendee_ids")
