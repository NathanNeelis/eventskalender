import {
  Autocomplete,
  Button,
  Grid,
  Group,
  Modal,
  MultiSelect,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { DateInput, TimeInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconClock } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useEffect } from 'react'
import { useColleagues, useOrganisations, useSaveEvent } from '../api/hooks'
import type { EventInput, Location, MdscEvent } from '../api/types'
import { API_DATETIME } from '../utils/dates'
import LocationPicker from './LocationPicker'

interface Props {
  opened: boolean
  onClose: () => void
  /** Event to edit; omit to create a new one. */
  event?: MdscEvent | null
  /** Pre-fill the start date when creating (e.g. from the calendar). */
  initialDate?: string | null
}

interface FormValues {
  title: string
  organisation: string
  startDate: string | null
  startTime: string
  allDay: boolean
  endDate: string | null
  endTime: string
  location: Location
  type: 'internal' | 'external'
  description: string
  invitation: string
  info_url: string
  attendee_ids: string[]
}

function toFormValues(event?: MdscEvent | null, initialDate?: string | null): FormValues {
  if (!event) {
    return {
      title: '',
      organisation: '',
      startDate: initialDate ?? dayjs().format('YYYY-MM-DD'),
      startTime: '09:00',
      allDay: false,
      endDate: null,
      endTime: '',
      location: { address: '', lat: null, lng: null },
      type: 'external',
      description: '',
      invitation: '',
      info_url: '',
      attendee_ids: [],
    }
  }
  const start = dayjs(event.start)
  const end = event.end ? dayjs(event.end) : null
  return {
    title: event.title,
    organisation: event.organisation,
    startDate: start.format('YYYY-MM-DD'),
    startTime: event.all_day ? '09:00' : start.format('HH:mm'),
    allDay: event.all_day,
    endDate: end && !end.isSame(start, 'day') ? end.format('YYYY-MM-DD') : null,
    endTime: end && !event.all_day ? end.format('HH:mm') : '',
    location: { ...event.location },
    type: event.is_internal ? 'internal' : 'external',
    description: event.description,
    invitation: event.invitation,
    info_url: event.info_url ?? '',
    attendee_ids: event.attendee_ids,
  }
}

function computeRange(v: FormValues): { start: dayjs.Dayjs; end: dayjs.Dayjs | null } | null {
  if (!v.startDate) return null
  const startDay = dayjs(v.startDate)
  if (v.allDay) {
    return { start: startDay.startOf('day'), end: v.endDate ? dayjs(v.endDate).startOf('day') : null }
  }
  const withTime = (day: dayjs.Dayjs, time: string) => {
    const [h, m] = time.split(':').map(Number)
    return day.hour(h || 0).minute(m || 0).second(0).millisecond(0)
  }
  const start = withTime(startDay, v.startTime || '00:00')
  if (!v.endDate && !v.endTime) return { start, end: null }
  const end = withTime(v.endDate ? dayjs(v.endDate) : startDay, v.endTime || v.startTime || '00:00')
  return { start, end }
}

function toInput(v: FormValues): EventInput {
  const range = computeRange(v)!
  return {
    title: v.title.trim(),
    organisation: v.organisation.trim(),
    start: range.start.format(API_DATETIME),
    end: range.end ? range.end.format(API_DATETIME) : null,
    all_day: v.allDay,
    location: { ...v.location, address: v.location.address.trim() },
    is_internal: v.type === 'internal',
    description: v.description.trim(),
    invitation: v.invitation.trim(),
    info_url: v.info_url.trim() || null,
    attendee_ids: v.attendee_ids,
  }
}

export default function EventFormModal({ opened, onClose, event, initialDate }: Props) {
  const isEdit = Boolean(event)
  const { data: colleagues = [] } = useColleagues()
  const { data: organisations = [] } = useOrganisations()
  const save = useSaveEvent()

  const form = useForm<FormValues>({
    initialValues: toFormValues(event, initialDate),
    validate: {
      title: (v) => (v.trim() ? null : 'Title is required'),
      organisation: (v) => (v.trim() ? null : 'Organisation is required'),
      startDate: (v) => (v ? null : 'Date is required'),
      startTime: (v, values) => (values.allDay || v ? null : 'Start time is required'),
      endTime: (_v, values) => {
        const r = computeRange(values)
        return r?.end && r.end.isBefore(r.start) ? 'End must be after start' : null
      },
      endDate: (_v, values) => {
        const r = computeRange(values)
        return values.allDay && r?.end && r.end.isBefore(r.start) ? 'End date must be after start date' : null
      },
      info_url: (v) => (!v.trim() || /^https?:\/\/\S+$/i.test(v.trim()) ? null : 'Must start with http:// or https://'),
    },
  })

  // Reset the form whenever the modal is opened for a different event
  useEffect(() => {
    if (opened) {
      form.setValues(toFormValues(event, initialDate))
      form.resetDirty()
      form.clearErrors()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, event?.id, initialDate])

  const handleSubmit = form.onSubmit((values) => {
    save.mutate(
      { id: event?.id, data: toInput(values) },
      {
        onSuccess: (saved) => {
          notifications.show({
            message: `${isEdit ? 'Updated' : 'Added'} “${saved.title}”`,
            color: 'teal',
            icon: <IconCheck size={16} />,
          })
          onClose()
        },
        onError: (err) => notifications.show({ title: 'Could not save event', message: err.message, color: 'red' }),
      },
    )
  })

  const colleagueOptions = colleagues.map((c) => ({ value: c.id, label: c.name }))
  const functionById = new Map(colleagues.map((c) => [c.id, c.function]))

  return (
    <Modal opened={opened} onClose={onClose} title={isEdit ? 'Edit event' : 'Add event'} size="xl">
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput label="Title" required data-autofocus {...form.getInputProps('title')} />

          <Grid>
            <Grid.Col span={{ base: 12, sm: 8 }}>
              <Autocomplete
                label="Organisation"
                description="The organisation that runs the event"
                required
                data={organisations}
                {...form.getInputProps('organisation')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Text size="sm" fw={500} mb={4}>
                Type
              </Text>
              <SegmentedControl
                fullWidth
                data={[
                  { label: 'External', value: 'external' },
                  { label: 'Internal', value: 'internal' },
                ]}
                {...form.getInputProps('type')}
              />
            </Grid.Col>
          </Grid>

          <Switch label="All-day event" {...form.getInputProps('allDay', { type: 'checkbox' })} />

          <Grid>
            <Grid.Col span={{ base: 12, sm: form.values.allDay ? 6 : 4 }}>
              <DateInput
                label={form.values.allDay ? 'Start date' : 'Date'}
                required
                valueFormat="ddd D MMM YYYY"
                {...form.getInputProps('startDate')}
              />
            </Grid.Col>
            {!form.values.allDay && (
              <>
                <Grid.Col span={{ base: 6, sm: 4 }}>
                  <TimeInput
                    label="Start time"
                    required
                    leftSection={<IconClock size={16} />}
                    {...form.getInputProps('startTime')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 4 }}>
                  <TimeInput
                    label="End time"
                    leftSection={<IconClock size={16} />}
                    {...form.getInputProps('endTime')}
                  />
                </Grid.Col>
              </>
            )}
            <Grid.Col span={{ base: 12, sm: form.values.allDay ? 6 : 4 }}>
              <DateInput
                label="End date"
                description="Only for multi-day events"
                clearable
                valueFormat="ddd D MMM YYYY"
                minDate={form.values.startDate ?? undefined}
                {...form.getInputProps('endDate')}
              />
            </Grid.Col>
          </Grid>

          <LocationPicker
            value={form.values.location}
            onChange={(loc) => form.setFieldValue('location', loc)}
          />

          <Textarea label="Description" autosize minRows={3} maxRows={10} {...form.getInputProps('description')} />

          <Textarea
            label="Invitation"
            description="Paste the invitation link, or describe how to register"
            autosize
            minRows={2}
            maxRows={6}
            {...form.getInputProps('invitation')}
          />

          <TextInput label="More information (URL)" placeholder="https://…" {...form.getInputProps('info_url')} />

          <MultiSelect
            label="Attending colleagues"
            placeholder={
              colleagues.length === 0
                ? 'No team members yet — add them on the Team page'
                : form.values.attendee_ids.length
                  ? undefined
                  : 'Nobody yet — search colleagues'
            }
            data={colleagueOptions}
            renderOption={({ option }) => (
              <div>
                <Text size="sm">{option.label}</Text>
                {functionById.get(option.value) && (
                  <Text size="xs" c="dimmed">
                    {functionById.get(option.value)}
                  </Text>
                )}
              </div>
            )}
            searchable
            clearable
            hidePickedOptions
            nothingFoundMessage="No colleague found"
            {...form.getInputProps('attendee_ids')}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {isEdit ? 'Save changes' : 'Add event'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
