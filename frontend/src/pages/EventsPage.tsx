import {
  Alert,
  Button,
  Center,
  Container,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconCalendarMonth,
  IconList,
  IconMap,
  IconPlus,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useEvent, useEvents } from "../api/hooks";
import type { EventFilters, MdscEvent } from "../api/types";
import CalendarView from "../components/CalendarView";
import EventCard from "../components/EventCard";
import EventDetailModal from "../components/EventDetailModal";
import EventFiltersBar from "../components/EventFiltersBar";
import EventFormModal from "../components/EventFormModal";
import EventsMap from "../components/EventsMap";

type View = "list" | "calendar" | "map";

const defaultFilters = (): EventFilters => ({
  from: dayjs().format("YYYY-MM-DD"),
  to: null,
  organisation: null,
  attending: "all",
  internal: "all",
  q: "",
});

export default function EventsPage() {
  const [filters, setFilters] = useState<EventFilters>(defaultFilters);
  const [debouncedQ] = useDebouncedValue(filters.q, 300);
  const queryFilters = useMemo(
    () => ({ ...filters, q: debouncedQ }),
    [filters, debouncedQ],
  );
  const {
    data: events = [],
    isLoading,
    error,
    isFetching,
  } = useEvents(queryFilters);

  const [view, setView] = useState<View>("list");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MdscEvent | null>(null);
  const [initialDate, setInitialDate] = useState<string | null>(null);
  // The open event lives in the URL (?event=<id>) so other parts of the app, like the chat, can link to it
  const [searchParams, setSearchParams] = useSearchParams();
  const detailId = searchParams.get("event");
  const setDetailId = (id: string | null) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("event", id);
        else next.delete("event");
        return next;
      },
      { replace: true },
    );

  // Prefer the event from the list (fresh after edits); fall back to fetching it when filtered out
  const listed = detailId ? events.find((e) => e.id === detailId) : undefined;
  const { data: fetched } = useEvent(
    detailId && !listed && !isLoading ? detailId : null,
  );
  const detail = listed ?? fetched ?? null;

  const openCreate = (date: string | null = null) => {
    setEditing(null);
    setInitialDate(date);
    setFormOpen(true);
  };
  const openEdit = (e: MdscEvent) => {
    setEditing(e);
    setInitialDate(null);
    setFormOpen(true);
  };

  const attendingCount = events.filter((e) => e.attendee_ids.length > 0).length;

  return (
    <Container size="xl">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={2}>Events</Title>
            <Text c="dimmed" size="sm">
              {events.length} event{events.length === 1 ? "" : "s"} · team
              attending {attendingCount}
              {isFetching && !isLoading ? " · refreshing…" : ""}
            </Text>
          </div>
          <Group>
            <SegmentedControl
              value={view}
              onChange={(v) => setView(v as View)}
              data={[
                {
                  value: "list",
                  label: (
                    <Group gap={6} wrap="nowrap">
                      <IconList size={16} />
                      List
                    </Group>
                  ),
                },
                {
                  value: "calendar",
                  label: (
                    <Group gap={6} wrap="nowrap">
                      <IconCalendarMonth size={16} />
                      Calendar
                    </Group>
                  ),
                },
                {
                  value: "map",
                  label: (
                    <Group gap={6} wrap="nowrap">
                      <IconMap size={16} />
                      Map
                    </Group>
                  ),
                },
              ]}
            />
            <Button
              leftSection={<IconPlus size={18} />}
              onClick={() => openCreate()}
            >
              Add event
            </Button>
          </Group>
        </Group>

        <EventFiltersBar
          value={filters}
          onChange={setFilters}
          onReset={() => setFilters(defaultFilters())}
        />

        {error && (
          <Alert color="red" title="Could not load events">
            {error.message}. Is the backend running on port 8000?
          </Alert>
        )}

        {isLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : view === "list" ? (
          events.length === 0 ? (
            <Center py={60}>
              <Stack align="center" gap="xs">
                <Text c="dimmed">No events match these filters.</Text>
                <Button
                  variant="light"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => openCreate()}
                >
                  Add the first one
                </Button>
              </Stack>
            </Center>
          ) : (
            <Stack gap="sm">
              {events.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  onOpen={(ev) => setDetailId(ev.id)}
                  onEdit={openEdit}
                />
              ))}
            </Stack>
          )
        ) : view === "calendar" ? (
          <CalendarView
            events={events}
            onOpen={(ev) => setDetailId(ev.id)}
            onAddOnDay={openCreate}
          />
        ) : (
          <EventsMap events={events} onOpen={(ev) => setDetailId(ev.id)} />
        )}
      </Stack>

      <EventFormModal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        event={editing}
        initialDate={initialDate}
      />
      <EventDetailModal
        event={detail}
        onClose={() => setDetailId(null)}
        onEdit={(e) => {
          setDetailId(null);
          openEdit(e);
        }}
      />
    </Container>
  );
}
