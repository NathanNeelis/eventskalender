import {
  ActionIcon,
  Affix,
  Anchor,
  Box,
  Group,
  Indicator,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
  Transition,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCheck,
  IconMessageChatbot,
  IconPlayerStopFilled,
  IconRefresh,
  IconSend2,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import {
  endChatSession,
  streamChat,
  type AgentEvent,
  type ToolResult,
} from "../api/agent";
import classes from "./ChatWidget.module.css";

interface Step {
  name: string;
  status: "running" | "ok" | "error";
  label: string;
  eventId?: string;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  steps: Step[];
  thinking?: boolean;
  pending?: boolean;
  error?: string;
}

const RUNNING_LABELS: Record<string, string> = {
  create_event: "Creating event…",
  update_event: "Updating event…",
  list_team_members: "Checking the team…",
  find_team_members: "Looking up team members…",
  add_attendees: "Adding attendees…",
};

function finishedStep(name: string, result: ToolResult): Omit<Step, "name"> {
  if (!result.ok) {
    const existing = result.existing_event;
    if (existing)
      return {
        status: "error",
        label: `Already exists: ${existing.title}`,
        eventId: existing.event_id,
      };
    return { status: "error", label: result.error ?? "Something went wrong" };
  }
  switch (name) {
    case "create_event":
      return {
        status: "ok",
        label: `Event created: ${result.event?.title}`,
        eventId: result.event?.event_id,
      };
    case "update_event":
      return {
        status: "ok",
        label: `Event updated: ${result.event?.title}`,
        eventId: result.event?.event_id,
      };
    case "add_attendees":
      return {
        status: "ok",
        label: `Attending: ${(result.added ?? []).join(", ")}`,
        eventId: result.event?.event_id,
      };
    case "find_team_members":
      return {
        status: "ok",
        label: `Looked up: ${(result.results ?? []).map((r) => r.query).join(", ") || "team"}`,
      };
    default:
      return { status: "ok", label: "Checked the team" };
  }
}

const WELCOME =
  "Hoi! Plak hier een **uitnodigingsmail** en ik maak het evenement voor je aan. " +
  "Daarna kan ik de teamleden die aanwezig zijn toevoegen.";

let nextId = 1;

export default function ChatWidget() {
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(false);
  const sessionId = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const openedRef = useRef(opened);

  useEffect(() => {
    openedRef.current = opened;
  }, [opened]);

  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight });
  }, [messages, opened]);

  const updateLast = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

  const handleEvent = (ev: AgentEvent) => {
    switch (ev.type) {
      case "session":
        sessionId.current = ev.session_id;
        break;
      case "thinking":
        updateLast((m) => ({ ...m, thinking: true }));
        break;
      case "delta":
        updateLast((m) => ({
          ...m,
          thinking: false,
          content: m.content + ev.content,
        }));
        break;
      case "tool_start":
        updateLast((m) => ({
          ...m,
          thinking: false,
          steps: [
            ...m.steps,
            {
              name: ev.name,
              status: "running",
              label: RUNNING_LABELS[ev.name] ?? "Working…",
            },
          ],
        }));
        break;
      case "tool_result":
        updateLast((m) => {
          const steps = [...m.steps];
          const i = steps.findLastIndex(
            (s) => s.name === ev.name && s.status === "running",
          );
          if (i >= 0)
            steps[i] = { ...steps[i], ...finishedStep(ev.name, ev.result) };
          return { ...m, steps };
        });
        break;
      case "error":
        updateLast((m) => ({ ...m, error: ev.message }));
        break;
      case "done":
        break;
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { id: nextId++, role: "user", content: text, steps: [] },
      {
        id: nextId++,
        role: "assistant",
        content: "",
        steps: [],
        pending: true,
      },
    ]);

    const controller = new AbortController();
    abort.current = controller;
    try {
      await streamChat(sessionId.current, text, handleEvent, controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) {
        updateLast((m) => ({
          ...m,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    } finally {
      updateLast((m) => ({ ...m, pending: false, thinking: false }));
      setBusy(false);
      abort.current = null;
      if (!openedRef.current) setUnread(true);
    }
  };

  const stop = () => abort.current?.abort();

  const newChat = () => {
    stop();
    if (sessionId.current) endChatSession(sessionId.current);
    sessionId.current = null;
    setMessages([]);
  };

  const open = () => {
    setOpened(true);
    setUnread(false);
  };

  return (
    <>
      <Affix position={{ bottom: 24, right: 24 }} zIndex={190}>
        <Transition transition="pop" mounted={!opened}>
          {(styles) => (
            <Indicator
              disabled={!unread}
              color="red"
              size={12}
              offset={6}
              style={styles}
            >
              <Tooltip label="Event assistant" position="left">
                <ActionIcon
                  size={56}
                  radius="xl"
                  variant="filled"
                  onClick={open}
                  aria-label="Open event assistant"
                >
                  <IconMessageChatbot size={30} />
                </ActionIcon>
              </Tooltip>
            </Indicator>
          )}
        </Transition>
      </Affix>

      <Affix position={{ bottom: 24, right: 24 }} zIndex={190}>
        <Transition transition="slide-up" mounted={opened}>
          {(styles) => (
            <Paper
              shadow="xl"
              withBorder
              className={classes.window}
              style={styles}
            >
              <Group
                justify="space-between"
                px="md"
                py="sm"
                className={classes.header}
              >
                <Group gap="xs">
                  <ThemeIcon variant="light" radius="xl">
                    <IconSparkles size={16} />
                  </ThemeIcon>
                  <div>
                    <Text fw={600} size="sm" lh={1.2}>
                      Event assistant
                    </Text>
                    <Text size="xs" c="dimmed" lh={1.2}>
                      Local AI · gpt-oss
                    </Text>
                  </div>
                </Group>
                <Group gap={4}>
                  <Tooltip label="New conversation">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={newChat}
                      aria-label="New conversation"
                    >
                      <IconRefresh size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => setOpened(false)}
                    aria-label="Close"
                  >
                    <IconX size={18} />
                  </ActionIcon>
                </Group>
              </Group>

              <ScrollArea
                className={classes.messages}
                viewportRef={viewport}
                px="md"
              >
                <Stack gap="sm" py="md">
                  <Bubble role="assistant">
                    <Markdown text={WELCOME} />
                  </Bubble>
                  {messages.map((m) => (
                    <Bubble key={m.id} role={m.role}>
                      {m.role === "user" ? (
                        <Text size="sm" className={classes.userText}>
                          {m.content}
                        </Text>
                      ) : (
                        <Stack gap={6}>
                          {m.steps.map((s, i) => (
                            <StepLine
                              key={i}
                              step={s}
                              onView={
                                s.eventId
                                  ? () => navigate(`/?event=${s.eventId}`)
                                  : undefined
                              }
                            />
                          ))}
                          {m.content && <Markdown text={m.content} />}
                          {m.pending && !m.content && (
                            <Group gap={6}>
                              <Loader size="xs" type="dots" />
                              <Text size="xs" c="dimmed">
                                {m.thinking
                                  ? "Thinking…"
                                  : m.steps.length
                                    ? "Working…"
                                    : "Reading…"}
                              </Text>
                            </Group>
                          )}
                          {m.error && (
                            <Group gap={6} wrap="nowrap" align="flex-start">
                              <IconAlertTriangle
                                size={16}
                                color="var(--mantine-color-red-6)"
                                style={{ flexShrink: 0 }}
                              />
                              <Text size="sm" c="red">
                                {m.error}
                              </Text>
                            </Group>
                          )}
                        </Stack>
                      )}
                    </Bubble>
                  ))}
                </Stack>
              </ScrollArea>

              <Box p="sm" className={classes.footer}>
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <Textarea
                    style={{ flex: 1 }}
                    placeholder={
                      messages.length ? "Reply…" : "Paste an invitation email…"
                    }
                    autosize
                    minRows={1}
                    maxRows={8}
                    value={input}
                    onChange={(e) => setInput(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    data-autofocus
                  />
                  {busy ? (
                    <Tooltip label="Stop">
                      <ActionIcon
                        size="lg"
                        color="red"
                        variant="light"
                        onClick={stop}
                        aria-label="Stop"
                      >
                        <IconPlayerStopFilled size={16} />
                      </ActionIcon>
                    </Tooltip>
                  ) : (
                    <ActionIcon
                      size="lg"
                      onClick={() => void send()}
                      disabled={!input.trim()}
                      aria-label="Send"
                    >
                      <IconSend2 size={18} />
                    </ActionIcon>
                  )}
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  Enter to send · Shift+Enter for a new line
                </Text>
              </Box>
            </Paper>
          )}
        </Transition>
      </Affix>
    </>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: ReactNode;
}) {
  return (
    <Box
      className={role === "user" ? classes.userBubble : classes.assistantBubble}
    >
      {children}
    </Box>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div className={classes.markdown}>
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <Anchor href={href} target="_blank" rel="noreferrer" size="sm">
              {children}
            </Anchor>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function StepLine({ step, onView }: { step: Step; onView?: () => void }) {
  return (
    <Group gap={6} wrap="nowrap" className={classes.step}>
      {step.status === "running" ? (
        <Loader size={12} />
      ) : step.status === "ok" ? (
        <IconCheck
          size={14}
          color="var(--mantine-color-teal-6)"
          style={{ flexShrink: 0 }}
        />
      ) : (
        <IconAlertTriangle
          size={14}
          color="var(--mantine-color-orange-6)"
          style={{ flexShrink: 0 }}
        />
      )}
      <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
        {step.label}
      </Text>
      {onView && step.status !== "running" && (
        <Anchor size="xs" component="button" onClick={onView}>
          View
        </Anchor>
      )}
    </Group>
  );
}
