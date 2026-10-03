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


async def geocode_address(q: str, limit: int = 5, timeout: float = 10) -> list[GeocodeResult]:
    """Look up an address with OpenStreetMap Nominatim. Raises httpx.HTTPError on failure."""
    async with httpx.AsyncClient(timeout=timeout, headers=HEADERS) as client:
        resp = await client.get(NOMINATIM_URL, params={"q": q, "format": "json", "limit": limit})
        resp.raise_for_status()
    return [
        GeocodeResult(label=r["display_name"], lat=float(r["lat"]), lng=float(r["lon"]))
        for r in resp.json()
    ]


@router.get("", response_model=list[GeocodeResult])
async def geocode(q: str = Query(min_length=3)):
    try:
        return await geocode_address(q)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Geocoding service unavailable: {exc}") from exc
