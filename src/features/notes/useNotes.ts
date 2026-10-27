import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { createNote, deleteNote, listNotes, updateNote } from './api'
import type { Note, NoteChanges } from './types'

// All of the user's notes, kept live. Edits show at once and roll back by
// reloading if the server refuses them.
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setNotes(await listNotes())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const channel = supabase
      .channel('notes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => reload())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [reload])

  const guard = useCallback(
    async (work: Promise<unknown>) => {
      try {
        await work
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save')
        await reload()
      }
    },
    [reload],
  )

  const add = useCallback(async (changes: NoteChanges = {}) => {
    const note = await createNote(changes)
    setNotes((ns) => (ns.some((n) => n.id === note.id) ? ns : [...ns, note]))
    return note
  }, [])

  const patch = useCallback(
    (id: string, changes: NoteChanges) => {
      const now = new Date().toISOString()
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, ...changes, updated_at: now } : n)))
      return guard(updateNote(id, changes))
    },
    [guard],
  )

  const remove = useCallback(
    (id: string) => {
      setNotes((ns) => ns.filter((n) => n.id !== id))
      return guard(deleteNote(id))
    },
    [guard],
  )

  return { notes, loading, error, reload, add, patch, remove }
}
