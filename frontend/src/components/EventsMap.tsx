import { Anchor, Box, Paper, Text } from '@mantine/core'
import L from 'leaflet'
import { useEffect } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import type { MdscEvent } from '../api/types'
import { formatEventWhen } from '../utils/dates'
import { DEFAULT_CENTER, TILE_ATTRIBUTION, TILE_URL } from './leaflet'

interface Props {
  events: MdscEvent[]
  onOpen: (event: MdscEvent) => void
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 13)
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 13 })
  }, [map, points])
  return null
}

export default function EventsMap({ events, onOpen }: Props) {
  const located = events.filter((e) => e.location.lat != null && e.location.lng != null)
  const points = located.map((e) => [e.location.lat!, e.location.lng!] as [number, number])
  const missing = events.length - located.length

  return (
    <Paper withBorder p="md">
      <Box h={560}>
        <MapContainer center={DEFAULT_CENTER} zoom={7} style={{ height: '100%' }}>
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <FitBounds points={points} />
          {located.map((e) => (
            <Marker key={e.id} position={[e.location.lat!, e.location.lng!]}>
              <Popup>
                <Text fw={600} size="sm">
                  {e.title}
                </Text>
                <Text size="xs">{formatEventWhen(e)}</Text>
                <Text size="xs" c="dimmed">
                  {e.organisation} · {e.attendee_ids.length} attending
                </Text>
                <Anchor size="xs" component="button" onClick={() => onOpen(e)}>
                  View details
                </Anchor>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Box>
      {missing > 0 && (
        <Text size="xs" c="dimmed" mt="xs">
          {missing} event{missing === 1 ? '' : 's'} without a map pin {missing === 1 ? 'is' : 'are'} not shown.
        </Text>
      )}
    </Paper>
  )
}
