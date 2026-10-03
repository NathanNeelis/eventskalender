"""In-process pub/sub used to push change notifications to browsers (SSE)."""

import asyncio
from typing import Any

_subscribers: set[asyncio.Queue] = set()


def subscribe() -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.add(queue)
    return queue


def unsubscribe(queue: asyncio.Queue) -> None:
    _subscribers.discard(queue)


def publish(kind: str, **payload: Any) -> None:
    """Notify all connected clients, e.g. publish("events_changed", id=..., action="created")."""
    message = {"kind": kind, **payload}
    for queue in list(_subscribers):
        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            # A stalled client; drop the message rather than block everyone else
            pass
