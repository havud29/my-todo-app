import { format, isSameDay } from 'date-fns'
import type { Occurrence } from './types'

export const weekStartsOn = 1 // Monday

export const timeLabel = (d: Date) => format(d, 'HH:mm')

export function occurrenceTimeLabel(o: Occurrence, day?: Date): string {
  if (o.event.all_day) return 'All day'
  if (day && !isSameDay(o.start, day)) {
    return isSameDay(o.end, day) ? `until ${timeLabel(o.end)}` : 'All day'
  }
  return `${timeLabel(o.start)} – ${timeLabel(o.end)}`
}
