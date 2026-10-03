"""Tools the chat agent can call. Each tool returns a JSON-serialisable dict for the model."""

import difflib
import re
import unicodedata
from datetime import date, datetime, time, timedelta
from typing import Any

import httpx
from bson import ObjectId
from pydantic import ValidationError

from ..db import get_db
from ..models import EventIn, Location
from ..routers.geocode import geocode_address
from ..services import events_service

# --------------------------------------------------------------------------- schemas

_EVENT_FIELDS: dict[str, Any] = {
    "title": {"type": "string", "description": "Short event title"},
    "organisation": {"type": "string", "description": "Organisation that runs/hosts the event"},
    "start_date": {"type": "string", "description": "Start date, YYYY-MM-DD"},
    "start_time": {"type": "string", "description": "Start time HH:MM (24h). Omit for all-day events."},
    "end_date": {"type": "string", "description": "End date YYYY-MM-DD, only for multi-day events"},
    "end_time": {"type": "string", "description": "End time HH:MM (24h), if known"},
    "location": {"type": "string", "description": "Venue and/or address, as precise as possible"},
    "is_internal": {"type": "boolean", "description": "True only if organised by our own department/organisation"},
    "description": {"type": "string", "description": "Concise summary of what the event is about (2-5 sentences)"},
    "invitation": {
        "type": "string",
        "description": "Registration/RSVP link, or how to register (deadline, contact person)",
    },
    "info_url": {"type": "string", "description": "URL with more information (http/https)"},
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "create_event",
            "description": "Create a new event in the database. Call once per event; use update_event for corrections.",
            "parameters": {
                "type": "object",
                "properties": _EVENT_FIELDS,
                "required": ["title", "organisation", "start_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_event",
            "description": "Change fields of an existing event, e.g. a new location or time. Pass ONLY the "
            "fields the user asked to change; never re-send title or description unless asked. "
            "Get the event_id from create_event or find_events.",
            "parameters": {
                "type": "object",
                "properties": {"event_id": {"type": "string"}, **_EVENT_FIELDS},
                "required": ["event_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_events",
            "description": "Search existing events by (part of) the title, organisation or location, optionally "
            "within a date range. Use this to get the event_id of an event the user refers to by name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Words from the event title, organisation or location"},
                    "date_from": {"type": "string", "description": "Only events on/after this date, YYYY-MM-DD"},
                    "date_to": {"type": "string", "description": "Only events on/before this date, YYYY-MM-DD"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_team_members",
            "description": "List all team members (id, name, function).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_team_members",
            "description": "Look up team members by (partial) name. Returns matches per name with a status: "
            "'unique', 'ambiguous' or 'not_found'.",
            "parameters": {
                "type": "object",
                "properties": {"names": {"type": "array", "items": {"type": "string"}}},
                "required": ["names"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_attendees",
            "description": "Mark team members as attending an event. Use ids returned by find_team_members.",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {"type": "string"},
                    "member_ids": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["event_id", "member_ids"],
            },
        },
    },
]

# --------------------------------------------------------------------------- helpers


class ToolError(Exception):
    pass


def _clean(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _parse_date(value: str, field: str) -> date:
    try:
        return date.fromisoformat(value.strip()[:10])
    except ValueError as exc:
        raise ToolError(f"{field} must be YYYY-MM-DD, got {value!r}") from exc


def _parse_time(value: str, field: str) -> time:
    m = re.fullmatch(r"(\d{1,2})[:.](\d{2})", value.strip())
    if not m or int(m[1]) > 23 or int(m[2]) > 59:
        raise ToolError(f"{field} must be HH:MM, got {value!r}")
    return time(int(m[1]), int(m[2]))


def _build_event(fields: dict[str, Any], attendee_ids: list[str], location: Location) -> EventIn:
    start_d = _parse_date(_clean(fields.get("start_date")), "start_date")
    start_t = _clean(fields.get("start_time"))
    end_d = _parse_date(_clean(fields["end_date"]), "end_date") if _clean(fields.get("end_date")) else None
    end_t = _clean(fields.get("end_time"))
    all_day = not start_t

    if all_day:
        start = datetime.combine(start_d, time.min)
        end = datetime.combine(end_d, time.min) if end_d else None
    else:
        st = _parse_time(start_t, "start_time")
        start = datetime.combine(start_d, st)
        end = None
        if end_t or end_d:
            et = _parse_time(end_t, "end_time") if end_t else st
            end = datetime.combine(end_d or start_d, et)

    info_url = _clean(fields.get("info_url")) or None
    if info_url and not re.match(r"https?://", info_url, re.I):
        info_url = None  # the model sometimes passes plain text; don't store an invalid link

    try:
        return EventIn(
            title=_clean(fields.get("title")),
            organisation=_clean(fields.get("organisation")),
            start=start,
            end=end,
            all_day=all_day,
            location=location,
            is_internal=bool(fields.get("is_internal", False)),
            description=_clean(fields.get("description")),
            invitation=_clean(fields.get("invitation")),
            info_url=info_url,
            attendee_ids=attendee_ids,
        )
    except ValidationError as exc:
        raise ToolError("; ".join(e["msg"] for e in exc.errors())) from exc


async def _geocode(address: str) -> Location:
    """Best effort: try the full address, then a few safer variants. Never guess without a place name."""
    loc = Location(address=address)
    if not address:
        return loc
    segments = [s.strip() for s in address.split(",") if s.strip()]
    candidates = [address]
    if len(segments) >= 3:
        # "Hall 7, Street 1, City": drop the room/hall but keep street + city
        candidates.append(", ".join(segments[1:]))
    if len(segments) >= 2:
        # "Venue City, Street 1": the venue name alone is often specific enough (e.g. "RAI Amsterdam").
        # Never search on a bare street name; that matches the same street in another city.
        candidates.append(segments[0])
    for q in candidates:
        try:
            results = await geocode_address(q, limit=1, timeout=6)
        except httpx.HTTPError:
            return loc
        if results:
            return Location(address=address, lat=results[0].lat, lng=results[0].lng)
    return loc


def _event_summary(doc: dict) -> dict:
    return {
        "event_id": str(doc["_id"]),
        "title": doc["title"],
        "organisation": doc.get("organisation", ""),
        "start": doc["start"].isoformat(timespec="minutes"),
        "end": doc["end"].isoformat(timespec="minutes") if doc.get("end") else None,
        "all_day": doc.get("all_day", False),
        "location": (doc.get("location") or {}).get("address", ""),
        "map_pin": (doc.get("location") or {}).get("lat") is not None,
        "is_internal": doc.get("is_internal", False),
        "attendee_count": len(doc.get("attendee_ids", [])),
    }


def _doc_to_fields(doc: dict) -> dict[str, Any]:
    start: datetime = doc["start"]
    end: datetime | None = doc.get("end")
    all_day = doc.get("all_day", False)
    return {
        "title": doc["title"],
        "organisation": doc.get("organisation", ""),
        "start_date": start.date().isoformat(),
        "start_time": "" if all_day else start.strftime("%H:%M"),
        "end_date": end.date().isoformat() if end and end.date() != start.date() else "",
        "end_time": end.strftime("%H:%M") if end and not all_day else "",
        "location": (doc.get("location") or {}).get("address", ""),
        "is_internal": doc.get("is_internal", False),
        "description": doc.get("description", ""),
        "invitation": doc.get("invitation", ""),
        "info_url": doc.get("info_url") or "",
    }


def _check_not_ambiguous(event_id: ObjectId, ctx: dict) -> None:
    """Refuse to change an event picked from several search matches before the user has chosen."""
    if str(event_id) in ctx.get("ambiguous_event_ids", []):
        raise ToolError(
            "Several events matched the search. Do not guess: ask the user which event they mean "
            "(list title and date), then make the change after they answer."
        )


def _oid(value: Any, what: str) -> ObjectId:
    if not isinstance(value, str) or not ObjectId.is_valid(value):
        raise ToolError(f"Invalid {what}: {value!r}")
    return ObjectId(value)


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", text.lower()).strip()


def match_members(query: str, members: list[dict]) -> list[dict]:
    """Exact name > all query words prefix name words > fuzzy similarity."""
    q = _norm(query)
    if not q:
        return []
    exact = [m for m in members if _norm(m["name"]) == q]
    if exact:
        return exact
    q_tokens = q.split()
    prefix = [
        m for m in members if all(any(t.startswith(qt) for t in _norm(m["name"]).split()) for qt in q_tokens)
    ]
    if prefix:
        return prefix

    def score(m: dict) -> float:
        name = _norm(m["name"])
        best = difflib.SequenceMatcher(None, q, name).ratio()
        for token in name.split():
            best = max(best, difflib.SequenceMatcher(None, q, token).ratio())
        return best

    scored = sorted(((score(m), m) for m in members), key=lambda x: -x[0])
    return [m for s, m in scored if s >= 0.8][:3]


# --------------------------------------------------------------------------- tools


async def create_event(args: dict, ctx: dict) -> dict:
    print("create_event args:", args)
    event = _build_event(args, [], await _geocode(_clean(args.get("location"))))

    # Guard against the model creating the same event twice
    day_start = datetime.combine(event.start.date(), time.min)
    existing = await get_db().events.find_one(
        {
            "title": {"$regex": f"^{re.escape(event.title)}$", "$options": "i"},
            "start": {"$gte": day_start, "$lt": day_start + timedelta(days=1)},
        }
    )
    if existing:
        ctx["event_id"] = str(existing["_id"])
        return {
            "ok": False,
            "error": "An event with this title already exists on this date. Use update_event instead.",
            "existing_event": _event_summary(existing),
        }

    doc = await events_service.create_event(event)
    ctx["event_id"] = str(doc["_id"])
    return {"ok": True, "event": _event_summary(doc)}


async def update_event(args: dict, ctx: dict) -> dict:
    event_id = _oid(args.get("event_id"), "event_id")
    _check_not_ambiguous(event_id, ctx)
    doc = await get_db().events.find_one({"_id": event_id})
    if doc is None:
        raise ToolError("Event not found")

    fields = _doc_to_fields(doc)
    # The model often re-sends every field; treat empty values as "unchanged" so nothing is wiped by accident
    changes = {k: v for k, v in args.items() if k in _EVENT_FIELDS and v is not None and v != ""}
    fields.update(changes)

    location = Location(**(doc.get("location") or {}))
    if "location" in changes and _clean(changes["location"]) != location.address:
        location = await _geocode(_clean(changes["location"]))

    event = _build_event(fields, [str(a) for a in doc.get("attendee_ids", [])], location)
    updated = await events_service.update_event(event_id, event)
    ctx["event_id"] = str(event_id)
    return {"ok": True, "event": _event_summary(updated)}


async def find_events(args: dict, ctx: dict) -> dict:
    conditions: list[dict] = []
    words = [w for w in re.split(r"\s+", _clean(args.get("query"))) if len(w) > 1]
    for word in words:
        # Every word must appear in the title, organisation or location (case-insensitive)
        rx = {"$regex": re.escape(word), "$options": "i"}
        conditions.append({"$or": [{"title": rx}, {"organisation": rx}, {"location.address": rx}]})
    if _clean(args.get("date_from")):
        start_of = datetime.combine(_parse_date(_clean(args["date_from"]), "date_from"), time.min)
        conditions.append({"$or": [{"end": {"$gte": start_of}}, {"end": None, "start": {"$gte": start_of}}]})
    if _clean(args.get("date_to")):
        end_of = datetime.combine(_parse_date(_clean(args["date_to"]), "date_to") + timedelta(days=1), time.min)
        conditions.append({"start": {"$lt": end_of}})

    query = {"$and": conditions} if conditions else {}
    docs = [d async for d in get_db().events.find(query).sort("start", 1).limit(11)]
    result: dict = {"ok": True, "count": min(len(docs), 10), "events": [_event_summary(d) for d in docs[:10]]}
    if len(docs) > 1:
        # Block changes to any of these until the user has said which one they mean (see _check_not_ambiguous)
        ctx["ambiguous_event_ids"] = [str(d["_id"]) for d in docs]
        result["note"] = "Several events match. Ask the user which one they mean before changing anything."
    if len(docs) > 10:
        result["note"] = "More than 10 matches. Ask the user to be more specific (e.g. a date)."
    if not docs:
        result["note"] = "No matching events. Try fewer or different words."
    return result


async def list_team_members(args: dict, ctx: dict) -> dict:
    members = [
        {"id": str(c["_id"]), "name": c["name"], "function": c.get("function", "")}
        async for c in get_db().colleagues.find().sort("name", 1)
    ]
    return {"ok": True, "count": len(members), "members": members}


async def find_team_members(args: dict, ctx: dict) -> dict:
    names = args.get("names") or []
    if isinstance(names, str):
        names = [n for n in re.split(r",| and | en ", names) if n.strip()]
    members = [
        {"id": str(c["_id"]), "name": c["name"], "function": c.get("function", "")}
        async for c in get_db().colleagues.find()
    ]
    if not members:
        return {"ok": True, "results": [], "note": "The team has no members yet. They can be added on the Team page."}

    results = []
    for name in names:
        found = match_members(str(name), members)
        status = "not_found" if not found else "unique" if len(found) == 1 else "ambiguous"
        results.append({"query": name, "status": status, "matches": found})
    return {"ok": True, "results": results}


async def add_attendees(args: dict, ctx: dict) -> dict:
    event_id = _oid(args.get("event_id"), "event_id")
    _check_not_ambiguous(event_id, ctx)
    ids = [_oid(i, "member id") for i in (args.get("member_ids") or [])]
    if not ids:
        raise ToolError("member_ids is empty")

    found = {c["_id"]: c["name"] async for c in get_db().colleagues.find({"_id": {"$in": ids}})}
    unknown = [str(i) for i in ids if i not in found]
    if not found:
        raise ToolError("None of these member ids exist. Use find_team_members first.")

    doc = await events_service.add_attendees(event_id, list(found))
    if doc is None:
        raise ToolError("Event not found")
    ctx["event_id"] = str(event_id)
    names = {c["_id"]: c["name"] async for c in get_db().colleagues.find({"_id": {"$in": doc["attendee_ids"]}})}
    return {
        "ok": True,
        "added": sorted(found.values()),
        "unknown_ids": unknown,
        "all_attendees": sorted(names.values()),
        "event": _event_summary(doc),
    }


TOOLS = {
    "create_event": create_event,
    "update_event": update_event,
    "find_events": find_events,
    "list_team_members": list_team_members,
    "find_team_members": find_team_members,
    "add_attendees": add_attendees,
}


async def run_tool(name: str, args: Any, ctx: dict) -> dict:
    fn = TOOLS.get(name)
    if fn is None:
        return {"ok": False, "error": f"Unknown tool {name!r}"}
    if not isinstance(args, dict):
        return {"ok": False, "error": "Arguments must be an object"}
    try:
        return await fn(args, ctx)
    except ToolError as exc:
        return {"ok": False, "error": str(exc)}
