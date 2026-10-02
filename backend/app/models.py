from datetime import datetime
from typing import Any

from bson import ObjectId
from pydantic import BaseModel, Field, model_validator


class Location(BaseModel):
    address: str = ""
    lat: float | None = None
    lng: float | None = None


class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    organisation: str = Field(default="", max_length=200)
    start: datetime
    end: datetime | None = None
    all_day: bool = False
    location: Location = Field(default_factory=Location)
    is_internal: bool = False
    description: str = ""
    invitation: str = ""
    info_url: str | None = None
    attendee_ids: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def check(self) -> "EventIn":
        # Times are stored as local wall-clock time (no timezone)
        self.start = self.start.replace(tzinfo=None)
        if self.end is not None:
            self.end = self.end.replace(tzinfo=None)
            if self.end < self.start:
                raise ValueError("End must be after start")
        self.organisation = self.organisation.strip()
        for cid in self.attendee_ids:
            if not ObjectId.is_valid(cid):
                raise ValueError(f"Invalid colleague id: {cid}")
        return self

    def to_doc(self) -> dict[str, Any]:
        doc = self.model_dump()
        doc["attendee_ids"] = [ObjectId(c) for c in dict.fromkeys(self.attendee_ids)]
        return doc


class EventOut(EventIn):
    id: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_doc(cls, doc: dict[str, Any]) -> "EventOut":
        return cls.model_construct(
            id=str(doc["_id"]),
            title=doc["title"],
            organisation=doc.get("organisation", ""),
            start=doc["start"],
            end=doc.get("end"),
            all_day=doc.get("all_day", False),
            location=Location(**(doc.get("location") or {})),
            is_internal=doc.get("is_internal", False),
            description=doc.get("description", ""),
            invitation=doc.get("invitation", ""),
            info_url=doc.get("info_url"),
            attendee_ids=[str(c) for c in doc.get("attendee_ids", [])],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        )


class ColleagueUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    active: bool | None = None


class ColleagueOut(BaseModel):
    id: str
    name: str
    active: bool = True

    @classmethod
    def from_doc(cls, doc: dict[str, Any]) -> "ColleagueOut":
        return cls(id=str(doc["_id"]), name=doc["name"], active=doc.get("active", True))
