import { supabase } from '../../lib/supabase'
import type { CalendarEvent, EventInput } from './types'

const columns = 'id,title,description,location,starts_at,ends_at,all_day,recurrence,color'

// Events that can appear between from and to: repeating ones that started
// before the range ends, and one-off ones that overlap it.
export async function listEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
  const f = from.toISOString()
  const { data, error } = await supabase
    .from('events')
    .select(columns)
    .is('deleted_at', null)
    .lt('starts_at', to.toISOString())
    .or(`recurrence.not.is.null,ends_at.gte."${f}",starts_at.gte."${f}"`)
    .order('starts_at')
  if (error) throw error
  return data
}

export async function createEvent(input: EventInput): Promise<void> {
  const { error } = await supabase.from('events').insert(input)
  if (error) throw error
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const { error } = await supabase.from('events').update(input).eq('id', id)
  if (error) throw error
}

// Soft delete, so other devices learn about it when they sync
export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
