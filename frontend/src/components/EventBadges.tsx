import { Avatar, Badge, Group, Text, Tooltip } from '@mantine/core'
import { IconUsers } from '@tabler/icons-react'
import { useColleagueNames } from '../api/hooks'
import type { MdscEvent } from '../api/types'

export function TypeBadge({ event }: { event: MdscEvent }) {
  return event.is_internal ? (
    <Badge color="grape" variant="light">
      Internal
    </Badge>
  ) : (
    <Badge color="cyan" variant="light">
      External
    </Badge>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Compact avatar stack of attendees. */
export function AttendeeAvatars({ event, max = 6 }: { event: MdscEvent; max?: number }) {
  const names = useColleagueNames()
  const attendees = event.attendee_ids.map((id) => names.get(id)).filter((n): n is string => Boolean(n))

  if (attendees.length === 0) {
    return (
      <Group gap={6}>
        <IconUsers size={16} color="var(--mantine-color-dimmed)" />
        <Text size="sm" c="dimmed">
          Nobody attending yet
        </Text>
      </Group>
    )
  }

  const shown = attendees.slice(0, max)
  const rest = attendees.slice(max)
  return (
    <Group gap="xs" wrap="nowrap">
      <Tooltip.Group openDelay={200}>
        <Avatar.Group spacing="xs">
          {shown.map((n) => (
            <Tooltip key={n} label={n} withArrow>
              <Avatar size="sm" radius="xl" color="initials" name={n}>
                {initials(n)}
              </Avatar>
            </Tooltip>
          ))}
          {rest.length > 0 && (
            <Tooltip label={rest.join(', ')} withArrow multiline maw={260}>
              <Avatar size="sm" radius="xl">
                +{rest.length}
              </Avatar>
            </Tooltip>
          )}
        </Avatar.Group>
      </Tooltip.Group>
      <Text size="sm" c="dimmed">
        {attendees.length} attending
      </Text>
    </Group>
  )
}

/** Full list of attendee names as badges. */
export function AttendeeList({ event }: { event: MdscEvent }) {
  const names = useColleagueNames()
  const attendees = event.attendee_ids
    .map((id) => names.get(id))
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  if (attendees.length === 0)
    return (
      <Text size="sm" c="dimmed">
        Nobody from the team is attending yet.
      </Text>
    )
  return (
    <Group gap={6}>
      {attendees.map((n) => (
        <Badge key={n} variant="outline" color="indigo" radius="sm" tt="none">
          {n}
        </Badge>
      ))}
    </Group>
  )
}
