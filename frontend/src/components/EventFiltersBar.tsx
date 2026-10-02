import { Button, Grid, Paper, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useOrganisations } from '../api/hooks'
import type { EventFilters } from '../api/types'

interface Props {
  value: EventFilters
  onChange: (value: EventFilters) => void
  onReset: () => void
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        {label}
      </Text>
      {children}
    </Stack>
  )
}

export default function EventFiltersBar({ value, onChange, onReset }: Props) {
  const { data: organisations = [] } = useOrganisations()
  const set = <K extends keyof EventFilters>(key: K, v: EventFilters[K]) => onChange({ ...value, [key]: v })

  return (
    <Paper withBorder p="md">
      <Grid align="flex-end">
        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <TextInput
            label="Search"
            placeholder="Title, description, location…"
            leftSection={<IconSearch size={16} />}
            value={value.q}
            onChange={(e) => set('q', e.currentTarget.value)}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <DatePickerInput
            type="range"
            label="Date range"
            placeholder="Any date"
            clearable
            allowSingleDateInRange
            valueFormat="D MMM YYYY"
            value={[value.from, value.to]}
            onChange={([from, to]) => onChange({ ...value, from, to })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4, lg: 2 }}>
          <Select
            label="Organisation"
            placeholder="All organisations"
            data={organisations}
            searchable
            clearable
            value={value.organisation}
            onChange={(v) => set('organisation', v)}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2 }}>
          <Labelled label="Are we attending?">
            <SegmentedControl
              fullWidth
              value={value.attending}
              onChange={(v) => set('attending', v as EventFilters['attending'])}
              data={[
                { label: 'All', value: 'all' },
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
              ]}
            />
          </Labelled>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2 }}>
          <Labelled label="Type">
            <SegmentedControl
              fullWidth
              value={value.internal}
              onChange={(v) => set('internal', v as EventFilters['internal'])}
              data={[
                { label: 'All', value: 'all' },
                { label: 'Int.', value: 'internal' },
                { label: 'Ext.', value: 'external' },
              ]}
            />
          </Labelled>
        </Grid.Col>
      </Grid>
      <Button variant="subtle" size="xs" mt="sm" leftSection={<IconFilterOff size={14} />} onClick={onReset}>
        Reset filters (upcoming events)
      </Button>
    </Paper>
  )
}
