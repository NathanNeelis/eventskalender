from bson import ObjectId
from fastapi import APIRouter, HTTPException, status
from pymongo import ReturnDocument

from ..db import get_db
from ..models import ColleagueOut, ColleagueUpdate

router = APIRouter(prefix="/colleagues", tags=["colleagues"])


@router.get("", response_model=list[ColleagueOut])
async def list_colleagues():
    cursor = get_db().colleagues.find().sort("_id", 1)
    return [ColleagueOut.from_doc(d) async for d in cursor]


@router.put("/{colleague_id}", response_model=ColleagueOut)
async def update_colleague(colleague_id: str, update: ColleagueUpdate):
    if not ObjectId.is_valid(colleague_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Colleague not found")
    changes = update.model_dump(exclude_none=True)
    changes["name"] = changes["name"].strip()
    doc = await get_db().colleagues.find_one_and_update(
        {"_id": ObjectId(colleague_id)}, {"$set": changes}, return_document=ReturnDocument.AFTER
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Colleague not found")
    return ColleagueOut.from_doc(doc)
