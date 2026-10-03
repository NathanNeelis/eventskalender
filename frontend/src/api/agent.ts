export type AgentEvent =
  | { type: 'session'; session_id: string }
  | { type: 'thinking' }
  | { type: 'delta'; content: string }
  | { type: 'tool_start'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: ToolResult }
  | { type: 'done'; event_id: string | null }
  | { type: 'error'; message: string }

export interface ToolResult {
  ok: boolean
  error?: string
  event?: { event_id: string; title: string }
  existing_event?: { event_id: string; title: string }
  added?: string[]
  results?: { query: string; status: string }[]
  [key: string]: unknown
}

/** Sends one chat turn and calls onEvent for every streamed event (newline-delimited JSON). */
export async function streamChat(
  sessionId: string | null,
  message: string,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
    signal,
  })
  if (!res.ok || !res.body) {
    throw new Error(`Assistant unavailable (${res.status} ${res.statusText})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline: number
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) onEvent(JSON.parse(line) as AgentEvent)
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as AgentEvent)
}

export function endChatSession(sessionId: string): void {
  void fetch(`/api/agent/sessions/${sessionId}`, { method: 'DELETE' })
}
