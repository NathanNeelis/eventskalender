export interface Location {
  address: string
  lat: number | null
  lng: number | null
}

export interface EventInput {
  title: string
  organisation: string
  /** Local wall-clock time, e.g. "2026-10-15T13:00:00" */
  start: string
  end: string | null
  all_day: boolean
  location: Location
  is_internal: boolean
  description: string
  invitation: string
  info_url: string | null
  attendee_ids: string[]
}

export interface MdscEvent extends EventInput {
  id: string
  created_at: string
  updated_at: string
}

export interface Colleague {
  id: string
  name: string
  active: boolean
}

export interface GeocodeResult {
  label: string
  lat: number
  lng: number
}

export interface EventFilters {
  from: string | null
  to: string | null
  organisation: string | null
  attending: 'all' | 'yes' | 'no'
  internal: 'all' | 'internal' | 'external'
  q: string
}
