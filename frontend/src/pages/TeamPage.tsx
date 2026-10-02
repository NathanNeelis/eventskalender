import {
  Alert,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconBriefcase, IconCheck, IconUser, IconUserPlus } from '@tabler/icons-react'
import { useState, type KeyboardEvent } from 'react'
import { useColleagues, useCreateColleague, useUpdateColleague } from '../api/hooks'
import type { Colleague, ColleagueInput } from '../api/types'

function AddMemberModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const create = useCreateColleague()
  const form = useForm<ColleagueInput>({
    initialValues: { name: '', function: '' },
    validate: { name: (v) => (v.trim() ? null : 'Name is required') },
  })

  const close = () => {
    form.reset()
    onClose()
  }

  const handleSubmit = form.onSubmit((values) =>
    create.mutate(
      { name: values.name.trim(), function: values.function.trim() },
      {
        onSuccess: (c) => {
          notifications.show({ message: `Added ${c.name} to the team`, color: 'teal', icon: <IconCheck size={16} /> })
          close()
        },
        onError: (err) => notifications.show({ title: 'Could not add team member', message: err.message, color: 'red' }),
      },
    ),
  )

  return (
    <Modal opened={opened} onClose={close} title="Add team member">
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Name"
            required
            data-autofocus
            leftSection={<IconUser size={16} />}
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Function"
            placeholder="e.g. Data scientist"
            leftSection={<IconBriefcase size={16} />}
            {...form.getInputProps('function')}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} leftSection={<IconUserPlus size={16} />}>
              Add team member
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

function ColleagueRow({ colleague }: { colleague: Colleague }) {
  const [name, setName] = useState(colleague.name)
  const [fn, setFn] = useState(colleague.function)
  const update = useUpdateColleague()

  const save = () => {
    const data = { name: name.trim(), function: fn.trim() }
    if (!data.name) {
      setName(colleague.name)
      return
    }
    if (data.name === colleague.name && data.function === colleague.function) return
    update.mutate(
      { id: colleague.id, data },
      {
        onSuccess: () => notifications.show({ message: `Saved ${data.name}`, color: 'teal', icon: <IconCheck size={16} /> }),
        onError: (err) => {
          notifications.show({ title: 'Could not save', message: err.message, color: 'red' })
          setName(colleague.name)
          setFn(colleague.function)
        },
      },
    )
  }

  const keyHandler = (reset: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') reset()
  }

  return (
    <Paper withBorder p="sm">
      <Stack gap={6}>
        <TextInput
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onBlur={save}
          onKeyDown={keyHandler(() => setName(colleague.name))}
          leftSection={<IconUser size={16} />}
          rightSection={update.isPending ? <Loader size="xs" /> : null}
          aria-label="Name"
          fw={600}
        />
        <TextInput
          value={fn}
          onChange={(e) => setFn(e.currentTarget.value)}
          onBlur={save}
          onKeyDown={keyHandler(() => setFn(colleague.function))}
          leftSection={<IconBriefcase size={16} />}
          placeholder="Function"
          aria-label="Function"
          size="xs"
        />
      </Stack>
    </Paper>
  )
}

export default function TeamPage() {
  const { data, isLoading, error } = useColleagues()
  const [addOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false)

  return (
    <Container size="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={2}>Team</Title>
            <Text c="dimmed" size="sm">
              {data ? `${data.length} team member${data.length === 1 ? '' : 's'} · ` : ''}
              Click a name or function to edit it. Changes are saved when you leave the field or press Enter.
            </Text>
          </div>
          <Button leftSection={<IconUserPlus size={18} />} onClick={openAdd}>
            Add team member
          </Button>
        </Group>

        {error && <Alert color="red" title="Could not load team">{error.message}</Alert>}
        {isLoading && <Loader />}
        {data && data.length === 0 && (
          <Center py={60}>
            <Stack align="center" gap="xs">
              <Text c="dimmed">No team members yet.</Text>
              <Button variant="light" leftSection={<IconUserPlus size={16} />} onClick={openAdd}>
                Add the first one
              </Button>
            </Stack>
          </Center>
        )}
        {data && data.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {data.map((c) => (
              <ColleagueRow key={`${c.id}:${c.name}:${c.function}`} colleague={c} />
            ))}
          </SimpleGrid>
        )}
      </Stack>

      <AddMemberModal opened={addOpen} onClose={closeAdd} />
    </Container>
  )
}
