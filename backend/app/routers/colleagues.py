from bson import ObjectId
from fastapi import APIRouter, HTTPException, status
from pymongo import ReturnDocument

from ..db import get_db
from ..models import ColleagueIn, ColleagueOut
from ..services.bus import publish

router = APIRouter(prefix="/colleagues", tags=["colleagues"])


@router.get("", response_model=list[ColleagueOut])
async def list_colleagues():
    cursor = get_db().colleagues.find().sort("_id", 1)
    return [ColleagueOut.from_doc(d) async for d in cursor]


@router.post("", response_model=ColleagueOut, status_code=status.HTTP_201_CREATED)
async def create_colleague(colleague: ColleagueIn):
    doc = colleague.model_dump() | {"active": True}
    result = await get_db().colleagues.insert_one(doc)
    doc["_id"] = result.inserted_id
    publish("colleagues_changed", action="created", id=str(doc["_id"]))
    return ColleagueOut.from_doc(doc)


@router.put("/{colleague_id}", response_model=ColleagueOut)
async def update_colleague(colleague_id: str, colleague: ColleagueIn):
    if not ObjectId.is_valid(colleague_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Colleague not found")
    doc = await get_db().colleagues.find_one_and_update(
        {"_id": ObjectId(colleague_id)}, {"$set": colleague.model_dump()}, return_document=ReturnDocument.AFTER
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Colleague not found")
    publish("colleagues_changed", action="updated", id=colleague_id)
    return ColleagueOut.from_doc(doc)
