import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { listEvents } from './api'
import { expandOccurrences } from './occurrences'
import type { CalendarEvent } from './types'

export function useEvents(from: Date, to: Date) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fromMs = from.getTime()
  const toMs = to.getTime()
  const loading = loadedKey !== `${fromMs}-${toMs}`

  const reload = useCallback(async () => {
    try {
      setEvents(await listEvents(new Date(fromMs), new Date(toMs)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load events')
    } finally {
      setLoadedKey(`${fromMs}-${toMs}`)
    }
  }, [fromMs, toMs])

  useEffect(() => {
    reload()
  }, [reload])

  // Changes made on another device show up while the app is open
  useEffect(() => {
    const channel = supabase
      .channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => reload())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [reload])

  const occurrences = useMemo(
    () => expandOccurrences(events, new Date(fromMs), new Date(toMs)),
    [events, fromMs, toMs],
  )

  return { occurrences, loading, error, reload }
}
