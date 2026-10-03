"""Tool-calling agent loop on a local Ollama model, streamed to the browser as events.
Change LLM here if you are using a different model provider, e.g. OpenAI or LLaMA.cpp.
"""

import asyncio
import json
import time
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import httpx

from ..config import settings
from .prompt import build_system_prompt
from .tools import TOOL_SCHEMAS, run_tool

MAX_STEPS = 8
SESSION_TTL = 6 * 3600


@dataclass
class Session:
    id: str
    messages: list[dict] = field(default_factory=list)
    ctx: dict = field(default_factory=dict)  # e.g. {"event_id": "..."} of the event being discussed
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    touched: float = field(default_factory=time.monotonic)


_sessions: dict[str, Session] = {}


def get_session(session_id: str | None) -> Session:
    now = time.monotonic()
    for sid in [s.id for s in _sessions.values() if now - s.touched > SESSION_TTL]:
        _sessions.pop(sid, None)

    session = _sessions.get(session_id or "")
    if session is None:
        session = Session(id=uuid.uuid4().hex)
        _sessions[session.id] = session
    session.touched = now
    return session


def reset_session(session_id: str) -> None:
    _sessions.pop(session_id, None)


async def _ollama_stream(messages: list[dict]) -> AsyncIterator[dict]:
    """
    Stream chat responses from Ollama as decoded JSON chunks.

    The request enables tool calling and optionally exposes the model's
    internal reasoning (`think`). Each yielded chunk contains the fields
    returned by Ollama, typically including `message.content`,
    `message.thinking`, and `message.tool_calls`.

    Raises:
        RuntimeError: If Ollama returns a non-200 response or reports an
            error in a streamed chunk.
        json.JSONDecodeError: If Ollama sends a malformed JSON line.
    """
    payload = {
        "model": settings.ollama_model,
        "messages": messages,
        "tools": TOOL_SCHEMAS,
        "stream": True,
        "think": settings.ollama_think,
        "options": {"num_ctx": settings.ollama_num_ctx, "temperature": 0.2},
    }

    # Use a generous read timeout because generation can take several minutes,
    # while keeping connection/setup timeouts relatively short.
    timeout = httpx.Timeout(connect=10, read=300, write=30, pool=10)

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            f"{settings.ollama_url}/api/chat",
            json=payload,
        ) as resp:
            if resp.status_code != 200:
                # Read the response body so Ollama's error message is included
                # in the exception instead of returning only the HTTP status.
                body = (await resp.aread()).decode(errors="replace")
                raise RuntimeError(f"Ollama returned {resp.status_code}: {body[:300]}")

            # Ollama sends one JSON object per line while the response is generated.
            async for line in resp.aiter_lines():
                if line.strip():
                    chunk = json.loads(line)

                    # Ollama can report application-level errors inside an otherwise
                    # successful HTTP stream, so check each chunk before yielding it.
                    if "error" in chunk:
                        raise RuntimeError(f"Ollama error: {chunk['error']}")

                    yield chunk




async def run_agent(session: Session, user_message: str) -> AsyncIterator[dict[str, Any]]:
    """Yields UI events: thinking, delta, tool_start, tool_result, done, error."""
    async with session.lock:
        session.messages.append({"role": "user", "content": user_message})
        system = {"role": "system", "content": build_system_prompt()}

        try:
            for _ in range(MAX_STEPS):
                content, thinking, tool_calls = "", "", []
                announced_thinking = False

                async for chunk in _ollama_stream([system, *session.messages]):
                    msg = chunk.get("message") or {}
                    if msg.get("thinking"):
                        thinking += msg["thinking"]
                        if not announced_thinking:
                            announced_thinking = True
                            yield {"type": "thinking"}
                    if msg.get("content"):
                        content += msg["content"]
                        yield {"type": "delta", "content": msg["content"]}
                    if msg.get("tool_calls"):
                        tool_calls.extend(msg["tool_calls"])

                assistant: dict[str, Any] = {"role": "assistant", "content": content}
                if thinking:
                    assistant["thinking"] = thinking
                if tool_calls:
                    assistant["tool_calls"] = tool_calls
                session.messages.append(assistant)

                if not tool_calls:
                    yield {"type": "done", "event_id": session.ctx.get("event_id")}
                    return

                for call in tool_calls:
                    fn = call.get("function") or {}
                    name = fn.get("name", "")
                    args = fn.get("arguments") or {}
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except json.JSONDecodeError:
                            args = {}
                    yield {"type": "tool_start", "name": name, "args": args}
                    result = await run_tool(name, args, session.ctx)
                    yield {"type": "tool_result", "name": name, "result": result}
                    session.messages.append(
                        {"role": "tool", "tool_name": name, "content": json.dumps(result, default=str)}
                    )

            yield {"type": "error", "message": "The assistant needed too many steps. Please try rephrasing."}
        except httpx.ConnectError:
            # Nothing was processed; drop the message so a retry doesn't send it twice
            if session.messages and session.messages[-1]["role"] == "user":
                session.messages.pop()
            yield {"type": "error", "message": f"Cannot reach Ollama at {settings.ollama_url}. Is it running?"}
        except (httpx.HTTPError, RuntimeError) as exc:
            yield {"type": "error", "message": str(exc)}
