export type EventColor = 'violet' | 'blue' | 'teal' | 'green' | 'amber' | 'rose'

export const eventColors: EventColor[] = ['violet', 'blue', 'teal', 'green', 'amber', 'rose']

export type Repeat = '' | 'FREQ=DAILY' | 'FREQ=WEEKLY' | 'FREQ=MONTHLY' | 'FREQ=YEARLY'

export const repeatLabels: Record<Repeat, string> = {
  '': 'Does not repeat',
  'FREQ=DAILY': 'Every day',
  'FREQ=WEEKLY': 'Every week',
  'FREQ=MONTHLY': 'Every month',
  'FREQ=YEARLY': 'Every year',
}

// A row of public.events. For all-day events starts_at and ends_at are local
// midnights of the first and last day (inclusive).
export interface CalendarEvent {
  id: string
  title: string
  description: string
  location: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
  recurrence: string | null
  color: string | null
}

export type EventInput = Omit<CalendarEvent, 'id'>

// One concrete appearance of an event in the visible range
export interface Occurrence {
  key: string
  event: CalendarEvent
  start: Date
  end: Date
}
