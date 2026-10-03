"""Event persistence shared by the REST API and the chat agent."""

from datetime import datetime

from bson import ObjectId
from pymongo import ReturnDocument

from ..db import get_db
from ..models import EventIn
from .bus import publish


async def create_event(event: EventIn) -> dict:
    now = datetime.now()
    doc = event.to_doc() | {"created_at": now, "updated_at": now}
    result = await get_db().events.insert_one(doc)
    doc["_id"] = result.inserted_id
    publish("events_changed", action="created", id=str(doc["_id"]))
    return doc


async def update_event(event_id: ObjectId, event: EventIn) -> dict | None:
    doc = await get_db().events.find_one_and_update(
        {"_id": event_id},
        {"$set": event.to_doc() | {"updated_at": datetime.now()}},
        return_document=ReturnDocument.AFTER,
    )
    if doc is not None:
        publish("events_changed", action="updated", id=str(event_id))
    return doc


async def delete_event(event_id: ObjectId) -> bool:
    result = await get_db().events.delete_one({"_id": event_id})
    if result.deleted_count:
        publish("events_changed", action="deleted", id=str(event_id))
    return bool(result.deleted_count)


async def add_attendees(event_id: ObjectId, colleague_ids: list[ObjectId]) -> dict | None:
    doc = await get_db().events.find_one_and_update(
        {"_id": event_id},
        {"$addToSet": {"attendee_ids": {"$each": colleague_ids}}, "$set": {"updated_at": datetime.now()}},
        return_document=ReturnDocument.AFTER,
    )
    if doc is not None:
        publish("events_changed", action="updated", id=str(event_id))
    return doc
