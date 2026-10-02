"""Minimal RFC 5545 calendar file generation for Outlook desktop."""

from datetime import datetime, timedelta, timezone

from ..models import EventOut


def _escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def _fold(line: str) -> str:
    """Fold lines longer than 75 octets, as required by the spec."""
    if len(line.encode("utf-8")) <= 75:
        return line
    parts: list[str] = []
    current = b""
    for ch in line:
        b = ch.encode("utf-8")
        limit = 75 if not parts else 74  # continuation lines start with a space
        if len(current) + len(b) > limit:
            parts.append(current.decode("utf-8"))
            current = b""
        current += b
    parts.append(current.decode("utf-8"))
    return "\r\n ".join(parts)


def _fmt(dt: datetime) -> str:
    # Floating local time: Outlook shows it in the user's own timezone
    return dt.strftime("%Y%m%dT%H%M%S")


def build_ics(event: EventOut, attendee_names: list[str]) -> str:
    if event.all_day:
        start_d = event.start.date()
        end_d = (event.end or event.start).date() + timedelta(days=1)  # DTEND is exclusive
        dtstart = f"DTSTART;VALUE=DATE:{start_d:%Y%m%d}"
        dtend = f"DTEND;VALUE=DATE:{end_d:%Y%m%d}"
    else:
        end = event.end or event.start + timedelta(hours=1)
        dtstart = f"DTSTART:{_fmt(event.start)}"
        dtend = f"DTEND:{_fmt(end)}"

    desc_parts = []
    if event.organisation:
        desc_parts.append(f"Organisation: {event.organisation}")
    desc_parts.append("Internal event" if event.is_internal else "External event")
    if event.description:
        desc_parts.append("\n" + event.description)
    if event.invitation:
        desc_parts.append("\nInvitation:\n" + event.invitation)
    if event.info_url:
        desc_parts.append("\nMore info: " + event.info_url)
    if attendee_names:
        desc_parts.append("\nAttending from MDSC: " + ", ".join(attendee_names))

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MDSC//MDSCevents//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{event.id}@mdscevents",
        f"DTSTAMP:{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}",
        dtstart,
        dtend,
        f"SUMMARY:{_escape(event.title)}",
        f"DESCRIPTION:{_escape(chr(10).join(desc_parts))}",
    ]
    if event.location.address:
        lines.append(f"LOCATION:{_escape(event.location.address)}")
    if event.location.lat is not None and event.location.lng is not None:
        lines.append(f"GEO:{event.location.lat};{event.location.lng}")
    if event.info_url:
        lines.append(f"URL:{event.info_url}")
    lines += ["END:VEVENT", "END:VCALENDAR"]
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"
