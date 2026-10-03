import dayjs from 'dayjs'
import type { MdscEvent } from '../api/types'

export const API_DATETIME = 'YYYY-MM-DDTHH:mm:ss'

/** Human-readable date/time range for an event. */
export function formatEventWhen(e: Pick<MdscEvent, 'start' | 'end' | 'all_day'>): string {
  const start = dayjs(e.start)
  const end = e.end ? dayjs(e.end) : null
  const sameDay = !end || end.isSame(start, 'day')

  if (e.all_day) {
    if (sameDay) return `${start.format('ddd D MMM YYYY')} · all day`
    return `${start.format('ddd D MMM')} – ${end!.format('ddd D MMM YYYY')}`
  }
  if (!end) return `${start.format('ddd D MMM YYYY')} · ${start.format('HH:mm')}`
  if (sameDay) return `${start.format('ddd D MMM YYYY')} · ${start.format('HH:mm')}–${end.format('HH:mm')}`
  return `${start.format('ddd D MMM HH:mm')} – ${end.format('ddd D MMM YYYY HH:mm')}`
}

export function isPast(e: Pick<MdscEvent, 'start' | 'end'>): boolean {
  const last = dayjs(e.end ?? e.start)
  return last.isBefore(dayjs(), 'day')
}

/** Does the event fall on (or span over) the given day? */
export function occursOn(e: Pick<MdscEvent, 'start' | 'end'>, day: dayjs.Dayjs): boolean {
  const start = dayjs(e.start).startOf('day')
  const end = dayjs(e.end ?? e.start).startOf('day')
  const d = day.startOf('day')
  return !d.isBefore(start) && !d.isAfter(end)
}
