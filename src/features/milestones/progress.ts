import { differenceInCalendarDays, formatDistanceStrict, parseISO, startOfDay } from 'date-fns'
import type { Milestone, Step } from './types'

export function progressOf(steps: Step[]) {
  const done = steps.filter((s) => s.done).length
  return { done, total: steps.length, pct: steps.length ? Math.round((done / steps.length) * 100) : 0 }
}

// "in 3 months", "today", "2 weeks overdue"
export function countdown(m: Milestone) {
  if (!m.target_date) return null
  const target = parseISO(m.target_date)
  const today = startOfDay(new Date())
  const days = differenceInCalendarDays(target, today)
  if (days === 0) return { label: 'Due today', overdue: false }
  const span = formatDistanceStrict(target, today, { roundingMethod: 'floor' })
  return days > 0 ? { label: `in ${span}`, overdue: false } : { label: `${span} overdue`, overdue: true }
}

// Soonest target first; goals without a date go last
export function byTarget(a: Milestone, b: Milestone) {
  return (a.target_date ?? '9999').localeCompare(b.target_date ?? '9999') || a.created_at.localeCompare(b.created_at)
}
