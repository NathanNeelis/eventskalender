import re
from datetime import date, datetime, time, timedelta

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Response, status
from pymongo import ReturnDocument

from ..db import get_db
from ..models import EventIn, EventOut
from ..services.ics import build_ics

router = APIRouter(prefix="/events", tags=["events"])


def _oid(event_id: str) -> ObjectId:
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return ObjectId(event_id)


async def _get_or_404(event_id: str) -> dict:
    doc = await get_db().events.find_one({"_id": _oid(event_id)})
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return doc


@router.get("", response_model=list[EventOut])
async def list_events(
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    organisation: str | None = None,
    attending: bool | None = None,
    internal: bool | None = None,
    q: str | None = None,
):
    conditions: list[dict] = []
    # Date filters match events that overlap the range, not only ones starting in it
    if date_to:
        conditions.append({"start": {"$lt": datetime.combine(date_to + timedelta(days=1), time.min)}})
    if date_from:
        start_of = datetime.combine(date_from, time.min)
        conditions.append(
            {"$or": [{"end": {"$gte": start_of}}, {"end": None, "start": {"$gte": start_of}}]}
        )
    if organisation:
        conditions.append({"organisation": organisation})
    if attending is not None:
        conditions.append({"attendee_ids.0": {"$exists": attending}})
    if internal is not None:
        conditions.append({"is_internal": internal})
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        conditions.append(
            {"$or": [{"title": rx}, {"description": rx}, {"location.address": rx}, {"organisation": rx}]}
        )

    query = {"$and": conditions} if conditions else {}
    cursor = get_db().events.find(query).sort("start", 1)
    return [EventOut.from_doc(d) async for d in cursor]


@router.get("/organisations", response_model=list[str])
async def list_organisations():
    values = await get_db().events.distinct("organisation")
    return sorted((v for v in values if v), key=str.lower)


@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: str):
    return EventOut.from_doc(await _get_or_404(event_id))


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
async def create_event(event: EventIn):
    now = datetime.now()
    doc = event.to_doc() | {"created_at": now, "updated_at": now}
    result = await get_db().events.insert_one(doc)
    doc["_id"] = result.inserted_id
    return EventOut.from_doc(doc)


@router.put("/{event_id}", response_model=EventOut)
async def update_event(event_id: str, event: EventIn):
    doc = await get_db().events.find_one_and_update(
        {"_id": _oid(event_id)},
        {"$set": event.to_doc() | {"updated_at": datetime.now()}},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return EventOut.from_doc(doc)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(event_id: str):
    result = await get_db().events.delete_one({"_id": _oid(event_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")


@router.get("/{event_id}/ics")
async def download_ics(event_id: str):
    doc = await _get_or_404(event_id)
    attendee_names: list[str] = []
    if doc.get("attendee_ids"):
        cursor = get_db().colleagues.find({"_id": {"$in": doc["attendee_ids"]}})
        attendee_names = sorted([c["name"] async for c in cursor], key=str.lower)
    body = build_ics(EventOut.from_doc(doc), attendee_names)
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", doc["title"]).strip("_")[:60] or "event"
    return Response(
        content=body,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{safe}.ics"'},
    )
