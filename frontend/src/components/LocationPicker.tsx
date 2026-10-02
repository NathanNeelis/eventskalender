import { Autocomplete, Box, Group, Loader, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconMapPin } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { api } from '../api/client'
import type { Location } from '../api/types'
import { DEFAULT_CENTER, TILE_ATTRIBUTION, TILE_URL } from './leaflet'

interface Props {
  value: Location
  onChange: (value: Location) => void
  error?: string
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 13))
  }, [lat, lng, map])
  return null
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

export default function LocationPicker({ value, onChange, error }: Props) {
  const [debounced] = useDebouncedValue(value.address.trim(), 500)
  const hasPin = value.lat != null && value.lng != null

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['geocode', debounced],
    queryFn: () => api.geocode(debounced),
    enabled: debounced.length >= 3,
    staleTime: Infinity,
    retry: false,
  })

  return (
    <Box>
      <Autocomplete
        label="Location"
        placeholder="Search an address or venue, or type freely"
        leftSection={<IconMapPin size={16} />}
        rightSection={isFetching ? <Loader size="xs" /> : null}
        value={value.address}
        error={error}
        data={results.map((r) => r.label)}
        filter={({ options }) => options}
        limit={5}
        onChange={(address) => {
          const match = results.find((r) => r.label === address)
          onChange(match ? { address, lat: match.lat, lng: match.lng } : { ...value, address })
        }}
      />
      <Box mt="xs" h={200}>
        <MapContainer
          center={hasPin ? [value.lat!, value.lng!] : DEFAULT_CENTER}
          zoom={hasPin ? 13 : 7}
          style={{ height: '100%' }}
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <ClickToPlace onPick={(lat, lng) => onChange({ ...value, lat, lng })} />
          {hasPin && (
            <>
              <Marker position={[value.lat!, value.lng!]} />
              <Recenter lat={value.lat!} lng={value.lng!} />
            </>
          )}
        </MapContainer>
      </Box>
      <Group justify="space-between" mt={4}>
        <Text size="xs" c="dimmed">
          Pick a search result or click on the map to place the pin.
        </Text>
        {hasPin && (
          <Text
            size="xs"
            c="red"
            style={{ cursor: 'pointer' }}
            onClick={() => onChange({ ...value, lat: null, lng: null })}
          >
            Remove pin
          </Text>
        )}
      </Group>
    </Box>
  )
}
