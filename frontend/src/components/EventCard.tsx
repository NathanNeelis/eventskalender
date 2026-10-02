import { Box, Card, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconBuilding, IconMapPin } from '@tabler/icons-react'
import dayjs from 'dayjs'
import type { MdscEvent } from '../api/types'
import { formatEventWhen, isPast } from '../utils/dates'
import EventActions from './EventActions'
import { AttendeeAvatars, TypeBadge } from './EventBadges'

interface Props {
  event: MdscEvent
  onOpen: (event: MdscEvent) => void
  onEdit: (event: MdscEvent) => void
}

function DateBlock({ start }: { start: string }) {
  const d = dayjs(start)
  return (
    <Stack
      gap={0}
      align="center"
      justify="center"
      w={64}
      py={6}
      style={{ borderRadius: 'var(--mantine-radius-md)', background: 'var(--mantine-color-indigo-light)', flexShrink: 0 }}
    >
      <Text size="xs" fw={700} tt="uppercase" c="indigo">
        {d.format('MMM')}
      </Text>
      <Text size="xl" fw={800} lh={1.1}>
        {d.format('D')}
      </Text>
      <Text size="xs" c="dimmed">
        {d.format('ddd')}
      </Text>
    </Stack>
  )
}

export default function EventCard({ event, onOpen, onEdit }: Props) {
  const past = isPast(event)
  return (
    <Card withBorder padding="md" style={{ opacity: past ? 0.65 : 1 }}>
      <Group align="flex-start" wrap="nowrap" gap="md">
        <DateBlock start={event.start} />
        <UnstyledButton onClick={() => onOpen(event)} style={{ flex: 1, minWidth: 0 }}>
          <Stack gap={4}>
            <Group gap="xs" wrap="nowrap">
              <Text fw={600} size="lg" truncate>
                {event.title}
              </Text>
              <TypeBadge event={event} />
            </Group>
            <Text size="sm" c="dimmed">
              {formatEventWhen(event)}
            </Text>
            <Group gap="md">
              <Group gap={4} wrap="nowrap">
                <IconBuilding size={14} />
                <Text size="sm">{event.organisation}</Text>
              </Group>
              {event.location.address && (
                <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
                  <IconMapPin size={14} style={{ flexShrink: 0 }} />
                  <Text size="sm" truncate maw={360}>
                    {event.location.address}
                  </Text>
                </Group>
              )}
            </Group>
            <Box mt={4}>
              <AttendeeAvatars event={event} />
            </Box>
          </Stack>
        </UnstyledButton>
        <EventActions event={event} onEdit={onEdit} compact />
      </Group>
    </Card>
  )
}
