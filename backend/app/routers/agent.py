import json

from fastapi import APIRouter, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..agent.agent import get_session, reset_session, run_agent

router = APIRouter(prefix="/agent", tags=["agent"])


class ChatRequest(BaseModel):
    session_id: str | None = None
    message: str = Field(min_length=1, max_length=50_000)


@router.post("/chat")
async def chat(req: ChatRequest):
    """Streams newline-delimited JSON events for one user turn."""
    session = get_session(req.session_id)

    async def body():
        yield json.dumps({"type": "session", "session_id": session.id}) + "\n"
        async for event in run_agent(session, req.message.strip()):
            yield json.dumps(event, default=str) + "\n"

    return StreamingResponse(
        body(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def end_session(session_id: str):
    reset_session(session_id)
