import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { weekStartsOn } from './format'

// The whole weeks shown for a month, as [start, end)
export function monthGridRange(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn })
  return { start, end: addDays(end, 1) }
}

export function weekRange(week: Date) {
  const start = startOfWeek(week, { weekStartsOn })
  return { start, end: addDays(start, 7) }
}
