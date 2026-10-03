import { Anchor, Box, Divider, Group, Modal, Stack, Text, Title } from '@mantine/core'
import { IconBuilding, IconCalendar, IconExternalLink, IconMapPin } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import type { MdscEvent } from '../api/types'
import { formatEventWhen } from '../utils/dates'
import EventActions from './EventActions'
import { AttendeeList, TypeBadge } from './EventBadges'
import { TILE_ATTRIBUTION, TILE_URL } from './leaflet'

interface Props {
  event: MdscEvent | null
  onClose: () => void
  onEdit: (event: MdscEvent) => void
}

/** Renders text with any http(s) URLs turned into links. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)])/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Anchor key={i} href={part} target="_blank" rel="noreferrer" inherit>
            {part} <IconExternalLink size={14} />
          </Anchor>
        ) : (
          part
        ),
      )}
    </>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={4}>
        {label}
      </Text>
      {children}
    </Box>
  )
}

export default function EventDetailModal({ event, onClose, onEdit }: Props) {
  return (
    <Modal opened={Boolean(event)} onClose={onClose} size="lg" title={event && <TypeBadge event={event} />}>
      {event && (
        <Stack gap="md">
          <Title order={3}>{event.title}</Title>

          <Stack gap={6}>
            <Group gap={8} wrap="nowrap">
              <IconCalendar size={18} />
              <Text>{formatEventWhen(event)}</Text>
            </Group>
            <Group gap={8} wrap="nowrap">
              <IconBuilding size={18} />
              <Text>{event.organisation || '—'}</Text>
            </Group>
            {event.location.address && (
              <Group gap={8} wrap="nowrap" align="flex-start">
                <IconMapPin size={18} style={{ flexShrink: 0, marginTop: 3 }} />
                <Text>{event.location.address}</Text>
              </Group>
            )}
          </Stack>

          {event.location.lat != null && event.location.lng != null && (
            <Box h={220}>
              <MapContainer
                center={[event.location.lat, event.location.lng]}
                zoom={14}
                style={{ height: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
                <Marker position={[event.location.lat, event.location.lng]} />
              </MapContainer>
            </Box>
          )}

          {event.description && (
            <Section label="Description">
              <Text style={{ whiteSpace: 'pre-wrap' }}>{event.description}</Text>
            </Section>
          )}

          {event.invitation && (
            <Section label="Invitation">
              <Text style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                <Linkified text={event.invitation} />
              </Text>
            </Section>
          )}

          {event.info_url && (
            <Section label="More information">
              <Anchor href={event.info_url} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>
                {event.info_url} <IconExternalLink size={14} />
              </Anchor>
            </Section>
          )}

          <Section label={`Attending (${event.attendee_ids.length})`}>
            <AttendeeList event={event} />
          </Section>

          <Divider />
          <Group justify="flex-end">
            <EventActions event={event} onEdit={onEdit} onDeleted={onClose} />
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
