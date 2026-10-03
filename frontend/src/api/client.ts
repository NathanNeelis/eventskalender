import type { Colleague, ColleagueInput, EventFilters, EventInput, GeocodeResult, MdscEvent } from './types'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') message = body.detail
      else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join(', ')
    } catch {
      // keep statusText
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function filtersToParams(f: EventFilters): string {
  const p = new URLSearchParams()
  if (f.from) p.set('from', f.from)
  if (f.to) p.set('to', f.to)
  if (f.organisation) p.set('organisation', f.organisation)
  if (f.attending !== 'all') p.set('attending', String(f.attending === 'yes'))
  if (f.internal !== 'all') p.set('internal', String(f.internal === 'internal'))
  if (f.q.trim()) p.set('q', f.q.trim())
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  listEvents: (f: EventFilters) => request<MdscEvent[]>(`/events${filtersToParams(f)}`),
  getEvent: (id: string) => request<MdscEvent>(`/events/${id}`),
  listOrganisations: () => request<string[]>('/events/organisations'),
  createEvent: (e: EventInput) => request<MdscEvent>('/events', { method: 'POST', body: JSON.stringify(e) }),
  updateEvent: (id: string, e: EventInput) =>
    request<MdscEvent>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(e) }),
  deleteEvent: (id: string) => request<void>(`/events/${id}`, { method: 'DELETE' }),
  icsUrl: (id: string) => `/api/events/${id}/ics`,

  listColleagues: () => request<Colleague[]>('/colleagues'),
  createColleague: (c: ColleagueInput) =>
    request<Colleague>('/colleagues', { method: 'POST', body: JSON.stringify(c) }),
  updateColleague: (id: string, c: ColleagueInput) =>
    request<Colleague>(`/colleagues/${id}`, { method: 'PUT', body: JSON.stringify(c) }),

  geocode: (q: string) => request<GeocodeResult[]>(`/geocode?q=${encodeURIComponent(q)}`),
}
