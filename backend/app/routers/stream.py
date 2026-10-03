"""Server-Sent Events stream that tells browsers when data changed."""

import asyncio
import json

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from ..services import bus

router = APIRouter(tags=["stream"])


@router.get("/stream")
async def stream(request: Request):
    queue = bus.subscribe()

    async def generator():
        try:
            yield {"event": "ready", "data": "{}"}
            while not await request.is_disconnected():
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15)
                except TimeoutError:
                    continue  # sse-starlette sends its own keep-alive pings
                yield {"event": message["kind"], "data": json.dumps(message)}
        finally:
            bus.unsubscribe(queue)

    return EventSourceResponse(generator(), ping=15)
