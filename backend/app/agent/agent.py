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

import requests
import urllib3

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


LLM_URL = settings.ollama_url + settings.llm_chat_endpoint
IS_OLLAMA = settings.llm_chat_endpoint == "/api/chat"

if not settings.llm_verify_ssl:
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def _normalize(data: dict) -> dict:
    """Return a response in Ollama's shape ({"message": {...}}), also when the server
    answered in OpenAI's chat-completions shape ({"choices": [{"message": {...}}]})."""
    if "choices" in data:
        msg = (data["choices"] or [{}])[0].get("message") or {}
        return {
            "message": {
                "content": msg.get("content") or "",
                "thinking": msg.get("reasoning_content") or msg.get("reasoning") or "",
                "tool_calls": msg.get("tool_calls") or [],
            }
        }
    return data


async def _ollama_stream(messages: list[dict]) -> AsyncIterator[dict]:
    """
    Stream chat responses from the LLM as decoded JSON chunks.

    The request enables tool calling and, for Ollama, optionally exposes the
    model's internal reasoning (`think`). Each yielded chunk is in Ollama's
    shape, typically including `message.content`, `message.thinking`, and
    `message.tool_calls`. Both Ollama's line-per-chunk stream and OpenAI's
    server-sent events are understood. With LLM_STREAM=false the whole reply
    is yielded as a single chunk, unless the server streams anyway.

    Raises:
        RuntimeError: If the server returns a non-200 response, reports an
            error in a streamed chunk, or sends a line that is not JSON.
    """
    payload = {
        "model": settings.ollama_model,
        "messages": messages,
        "tools": TOOL_SCHEMAS,
        "stream": settings.llm_stream,
    }
    if IS_OLLAMA:
        payload["think"] = settings.ollama_think
        payload["options"] = {"num_ctx": settings.ollama_num_ctx, "temperature": 0.2}

    headers = {"Content-Type": "application/json"}
    if settings.llm_api_key:
        headers["Authorization"] = settings.llm_api_key

    # (connect, read) timeouts: a generous read timeout because generation can take
    # several minutes, while keeping the connection timeout relatively short.
    timeout = (10, 300)

    # requests is blocking, so every call that waits on the network runs in a worker
    # thread to keep the event loop free for other requests.
    resp = await asyncio.to_thread(
        requests.post,
        LLM_URL,
        json=payload,
        headers=headers,
        stream=settings.llm_stream,
        timeout=timeout,
        verify=settings.llm_verify_ssl,
    )
    try:
        if resp.status_code != 200:
            # Read the response body so the server's error message is included
            # in the exception instead of returning only the HTTP status.
            body = await asyncio.to_thread(lambda: resp.content.decode(errors="replace"))
            raise RuntimeError(f"LLM returned {resp.status_code}: {body[:300]}")

        content_type = resp.headers.get("content-type", "unknown")
        is_sse = content_type.startswith("text/event-stream")

        # Some servers stream even when asked not to, so look at what actually came back
        if not settings.llm_stream and not is_sse:
            try:
                data = resp.json()
            except ValueError:
                raise RuntimeError(
                    f"Unexpected response from {LLM_URL} (content-type: {content_type}): {resp.text[:300]!r}"
                ) from None
            if "error" in data:
                raise RuntimeError(f"LLM error: {data['error']}")
            yield _normalize(data)
            return

        # Ollama sends one JSON object per line; OpenAI-style servers send
        # server-sent events ("data: {...}" lines, ending with "data: [DONE]").
        # OpenAI streams tool calls in fragments, collected here per index.
        sse_tool_calls: dict[int, dict] = {}
        lines = resp.iter_lines(decode_unicode=True)
        while (line := await asyncio.to_thread(next, lines, None)) is not None:
            if isinstance(line, bytes):
                line = line.decode("utf-8", errors="replace")
            line = line.strip()
            if not line or line.startswith(":") or line.startswith("event:"):
                continue
            if line.startswith("data:"):
                line = line[len("data:"):].strip()
                if line == "[DONE]":
                    break
            try:
                chunk = json.loads(line)
            except json.JSONDecodeError:
                # Neither format; show what we got instead
                raise RuntimeError(
                    f"Unexpected response from {LLM_URL} (content-type: {content_type}): {line[:300]!r}"
                ) from None

            # The server can report application-level errors inside an otherwise
            # successful HTTP stream, so check each chunk before yielding it.
            if "error" in chunk:
                raise RuntimeError(f"LLM error: {chunk['error']}")

            if "choices" not in chunk:
                yield chunk
                continue

            delta = (chunk["choices"] or [{}])[0].get("delta") or {}
            for tc in delta.get("tool_calls") or []:
                call = sse_tool_calls.setdefault(
                    tc.get("index", len(sse_tool_calls)),
                    {"id": None, "type": "function", "function": {"name": "", "arguments": ""}},
                )
                if tc.get("id"):
                    call["id"] = tc["id"]
                fn = tc.get("function") or {}
                call["function"]["name"] += fn.get("name") or ""
                args = fn.get("arguments") or ""
                call["function"]["arguments"] += args if isinstance(args, str) else json.dumps(args)
            yield {
                "message": {
                    "content": delta.get("content") or "",
                    "thinking": delta.get("reasoning_content") or delta.get("reasoning") or "",
                }
            }

        if sse_tool_calls:
            for call in sse_tool_calls.values():
                if call["id"] is None:
                    del call["id"]
            yield {"message": {"tool_calls": [sse_tool_calls[i] for i in sorted(sse_tool_calls)]}}
    finally:
        resp.close()




async def run_agent(session: Session, user_message: str) -> AsyncIterator[dict[str, Any]]:
    """Yields UI events: thinking, delta, tool_start, tool_result, done, error."""
    async with session.lock:
        session.messages.append({"role": "user", "content": user_message})
        # The user has now had the chance to say which event they meant
        session.ctx.pop("ambiguous_event_ids", None)
        system = {"role": "system", "content": build_system_prompt(user_message)}

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
                if thinking and IS_OLLAMA:
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
                    tool_msg = {"role": "tool", "content": json.dumps(result, default=str)}
                    # OpenAI-style servers link results to calls by id; Ollama by name
                    if call.get("id"):
                        tool_msg["tool_call_id"] = call["id"]
                    if IS_OLLAMA:
                        tool_msg["tool_name"] = name
                    session.messages.append(tool_msg)

            yield {"type": "error", "message": "The assistant needed too many steps. Please try rephrasing."}
        except requests.ConnectionError:
            # Nothing was processed; drop the message so a retry doesn't send it twice
            if session.messages and session.messages[-1]["role"] == "user":
                session.messages.pop()
            yield {"type": "error", "message": f"Cannot reach the LLM at {LLM_URL}. Is it running?"}
        except (requests.RequestException, RuntimeError) as exc:
            yield {"type": "error", "message": str(exc)}
