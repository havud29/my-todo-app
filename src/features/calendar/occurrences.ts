import { RRule } from 'rrule'
import { addDays, endOfDay, startOfDay } from 'date-fns'
import type { CalendarEvent, Occurrence } from './types'

// rrule works in UTC, so local wall-clock times are passed through as if they
// were UTC and converted back afterwards. This keeps "every Monday 9:00" at
// 9:00 across daylight-saving changes.
const toFakeUtc = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()))
const fromFakeUtc = (d: Date) =>
  new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes())

function eventEnd(event: CalendarEvent, start: Date): Date {
  if (event.all_day) {
    const last = event.ends_at ? new Date(event.ends_at) : start
    return endOfDay(last)
  }
  return event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + 60 * 60 * 1000)
}

// Expands events into the occurrences that overlap [from, to)
export function expandOccurrences(events: CalendarEvent[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = []

  for (const event of events) {
    const start = new Date(event.starts_at)
    const duration = eventEnd(event, start).getTime() - start.getTime()

    if (!event.recurrence) {
      const end = new Date(start.getTime() + duration)
      if (start < to && end >= from) out.push({ key: event.id, event, start, end })
      continue
    }

    const rule = new RRule({ ...RRule.parseString(event.recurrence), dtstart: toFakeUtc(start) })
    // Widen the window by the event's length so occurrences that began earlier but still overlap are kept
    const windowStart = toFakeUtc(new Date(from.getTime() - duration))
    for (const d of rule.between(windowStart, toFakeUtc(to), true)) {
      const s = fromFakeUtc(d)
      const end = new Date(s.getTime() + duration)
      if (s < to && end >= from) out.push({ key: `${event.id}@${s.toISOString()}`, event, start: s, end })
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || Number(b.event.all_day) - Number(a.event.all_day))
}

// Occurrences that touch the given day, all-day ones first
export function occurrencesOnDay(occurrences: Occurrence[], day: Date): Occurrence[] {
  const s = startOfDay(day)
  const e = addDays(s, 1)
  return occurrences
    .filter((o) => o.start < e && o.end > s)
    .sort((a, b) => Number(b.event.all_day) - Number(a.event.all_day) || a.start.getTime() - b.start.getTime())
}
