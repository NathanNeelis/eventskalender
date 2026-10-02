import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/geocode", tags=["geocode"])

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "MDSCevents/0.1 (internal event planner)"}


class GeocodeResult(BaseModel):
    label: str
    lat: float
    lng: float


@router.get("", response_model=list[GeocodeResult])
async def geocode(q: str = Query(min_length=3)):
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
            resp = await client.get(NOMINATIM_URL, params={"q": q, "format": "json", "limit": 5})
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Geocoding service unavailable: {exc}") from exc
    return [
        GeocodeResult(label=r["display_name"], lat=float(r["lat"]), lng=float(r["lon"]))
        for r in resp.json()
    ]
