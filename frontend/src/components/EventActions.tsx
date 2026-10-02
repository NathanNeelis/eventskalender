import { ActionIcon, Button, Group, Text, Tooltip } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconBrandWindows, IconPencil, IconTrash } from '@tabler/icons-react'
import { api } from '../api/client'
import { useDeleteEvent } from '../api/hooks'
import type { MdscEvent } from '../api/types'

interface Props {
  event: MdscEvent
  onEdit: (event: MdscEvent) => void
  onDeleted?: () => void
  compact?: boolean
}

export function OutlookButton({ event, compact }: { event: MdscEvent; compact?: boolean }) {
  if (compact) {
    return (
      <Tooltip label="Add to Outlook calendar">
        <ActionIcon component="a" href={api.icsUrl(event.id)} download variant="light" aria-label="Add to Outlook">
          <IconBrandWindows size={18} />
        </ActionIcon>
      </Tooltip>
    )
  }
  return (
    <Button component="a" href={api.icsUrl(event.id)} download variant="light" leftSection={<IconBrandWindows size={16} />}>
      Add to Outlook
    </Button>
  )
}

export default function EventActions({ event, onEdit, onDeleted, compact }: Props) {
  const del = useDeleteEvent()

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: 'Remove event',
      children: (
        <Text size="sm">
          Are you sure you want to remove <b>{event.title}</b>? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        del.mutate(event.id, {
          onSuccess: () => {
            notifications.show({ message: `Removed “${event.title}”`, color: 'gray' })
            onDeleted?.()
          },
          onError: (err) => notifications.show({ title: 'Could not remove event', message: err.message, color: 'red' }),
        }),
    })

  return (
    <Group gap={compact ? 4 : 'xs'} wrap="nowrap">
      <OutlookButton event={event} compact={compact} />
      <Tooltip label="Edit">
        <ActionIcon variant="subtle" color="gray" onClick={() => onEdit(event)} aria-label="Edit event">
          <IconPencil size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Remove">
        <ActionIcon variant="subtle" color="red" onClick={confirmDelete} loading={del.isPending} aria-label="Remove event">
          <IconTrash size={18} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}
