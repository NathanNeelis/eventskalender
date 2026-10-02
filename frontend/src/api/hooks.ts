import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from './client'
import type { Colleague, ColleagueInput, EventFilters, EventInput } from './types'

export function useEvents(filters: EventFilters) {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: () => api.listEvents(filters),
    placeholderData: keepPreviousData,
  })
}

export function useOrganisations() {
  return useQuery({ queryKey: ['organisations'], queryFn: api.listOrganisations })
}

export function useColleagues() {
  return useQuery({
    queryKey: ['colleagues'],
    queryFn: api.listColleagues,
    select: (list: Colleague[]) =>
      [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })),
  })
}

/** Map of colleague id -> name, for rendering attendee lists. */
export function useColleagueNames() {
  const { data } = useColleagues()
  return useMemo(() => new Map((data ?? []).map((c) => [c.id, c.name])), [data])
}

function useInvalidateEvents() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['events'] })
    qc.invalidateQueries({ queryKey: ['organisations'] })
  }
}

export function useSaveEvent() {
  const invalidate = useInvalidateEvents()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: EventInput }) =>
      id ? api.updateEvent(id, data) : api.createEvent(data),
    onSuccess: invalidate,
  })
}

export function useDeleteEvent() {
  const invalidate = useInvalidateEvents()
  return useMutation({ mutationFn: api.deleteEvent, onSuccess: invalidate })
}

export function useCreateColleague() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createColleague,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colleagues'] }),
  })
}

export function useUpdateColleague() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ColleagueInput }) => api.updateColleague(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colleagues'] }),
  })
}
