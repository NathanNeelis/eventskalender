import { Alert, Container, Loader, Paper, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconUser } from '@tabler/icons-react'
import { useState } from 'react'
import { useColleagues, useRenameColleague } from '../api/hooks'
import type { Colleague } from '../api/types'

function ColleagueRow({ colleague }: { colleague: Colleague }) {
  const [name, setName] = useState(colleague.name)
  const rename = useRenameColleague()
  const dirty = name.trim() !== colleague.name

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(colleague.name)
      return
    }
    if (!dirty) return
    rename.mutate(
      { id: colleague.id, name: trimmed },
      {
        onSuccess: () =>
          notifications.show({ message: `Renamed to ${trimmed}`, color: 'teal', icon: <IconCheck size={16} /> }),
        onError: (err) => {
          notifications.show({ title: 'Could not rename', message: err.message, color: 'red' })
          setName(colleague.name)
        },
      },
    )
  }

  return (
    <TextInput
      value={name}
      onChange={(e) => setName(e.currentTarget.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setName(colleague.name)
      }}
      leftSection={<IconUser size={16} />}
      rightSection={rename.isPending ? <Loader size="xs" /> : null}
      aria-label={`Name of ${colleague.name}`}
    />
  )
}

export default function TeamPage() {
  const { data, isLoading, error } = useColleagues()

  return (
    <Container size="lg">
      <Stack gap="md">
        <div>
          <Title order={2}>Team</Title>
          <Text c="dimmed" size="sm">
            Click a name to edit it. Changes are saved when you leave the field or press Enter.
          </Text>
        </div>
        {error && <Alert color="red" title="Could not load colleagues">{error.message}</Alert>}
        {isLoading && <Loader />}
        {data && (
          <Paper withBorder p="md">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              {data.map((c) => (
                <ColleagueRow key={`${c.id}:${c.name}`} colleague={c} />
              ))}
            </SimpleGrid>
          </Paper>
        )}
      </Stack>
    </Container>
  )
}
