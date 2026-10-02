import { ActionIcon, Badge, Box, Button, Group, Paper, SimpleGrid, Stack, Text, Title, Tooltip } from '@mantine/core'
import { IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import type { MdscEvent } from '../api/types'
import { occursOn } from '../utils/dates'

interface Props {
  events: MdscEvent[]
  onOpen: (event: MdscEvent) => void
  onAddOnDay: (date: string) => void
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function CalendarView({ events, onOpen, onAddOnDay }: Props) {
  const [month, setMonth] = useState(() => dayjs().startOf('month'))

  const days = useMemo(() => {
    // Weeks start on Monday
    const offset = (month.day() + 6) % 7
    const first = month.subtract(offset, 'day')
    const weeks = Math.ceil((offset + month.daysInMonth()) / 7)
    return Array.from({ length: weeks * 7 }, (_, i) => first.add(i, 'day'))
  }, [month])

  const today = dayjs()

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ActionIcon variant="default" onClick={() => setMonth((m) => m.subtract(1, 'month'))} aria-label="Previous month">
            <IconChevronLeft size={18} />
          </ActionIcon>
          <ActionIcon variant="default" onClick={() => setMonth((m) => m.add(1, 'month'))} aria-label="Next month">
            <IconChevronRight size={18} />
          </ActionIcon>
          <Title order={4} ml="xs">
            {month.format('MMMM YYYY')}
          </Title>
        </Group>
        <Button variant="default" size="xs" onClick={() => setMonth(dayjs().startOf('month'))}>
          Today
        </Button>
      </Group>

      <SimpleGrid cols={7} spacing={4} verticalSpacing={4}>
        {WEEKDAYS.map((d) => (
          <Text key={d} size="xs" fw={700} c="dimmed" ta="center" tt="uppercase">
            {d}
          </Text>
        ))}
        {days.map((day) => {
          const inMonth = day.month() === month.month()
          const isToday = day.isSame(today, 'day')
          const dayEvents = events.filter((e) => occursOn(e, day))
          return (
            <Box
              key={day.format('YYYY-MM-DD')}
              p={4}
              mih={96}
              style={{
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 'var(--mantine-radius-sm)',
                background: inMonth ? 'var(--mantine-color-body)' : 'var(--mantine-color-default-hover)',
                opacity: inMonth ? 1 : 0.6,
              }}
            >
              <Group justify="space-between" gap={0} mb={2}>
                <Text
                  size="xs"
                  fw={isToday ? 800 : 500}
                  c={isToday ? 'white' : undefined}
                  bg={isToday ? 'indigo' : undefined}
                  px={isToday ? 6 : 0}
                  style={{ borderRadius: 999 }}
                >
                  {day.date()}
                </Text>
                <Tooltip label="Add event on this day" openDelay={400}>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={() => onAddOnDay(day.format('YYYY-MM-DD'))}
                    aria-label="Add event on this day"
                  >
                    <IconPlus size={12} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Stack gap={2}>
                {dayEvents.map((e) => (
                  <Badge
                    key={e.id}
                    size="sm"
                    radius="sm"
                    fullWidth
                    variant={e.attendee_ids.length > 0 ? 'filled' : 'light'}
                    color={e.is_internal ? 'grape' : 'cyan'}
                    tt="none"
                    style={{ cursor: 'pointer', justifyContent: 'flex-start' }}
                    onClick={() => onOpen(e)}
                    title={e.title}
                  >
                    {!e.all_day && dayjs(e.start).isSame(day, 'day') ? `${dayjs(e.start).format('HH:mm')} ` : ''}
                    {e.title}
                  </Badge>
                ))}
              </Stack>
            </Box>
          )
        })}
      </SimpleGrid>
      <Group gap="md" mt="sm">
        <Text size="xs" c="dimmed">
          Legend:
        </Text>
        <Badge size="xs" color="cyan" variant="light" tt="none">External</Badge>
        <Badge size="xs" color="grape" variant="light" tt="none">Internal</Badge>
        <Text size="xs" c="dimmed">Solid = someone from the team is attending</Text>
      </Group>
    </Paper>
  )
}
