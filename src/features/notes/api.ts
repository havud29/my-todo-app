import { supabase } from '../../lib/supabase'
import type { Note, NoteChanges } from './types'

const columns = 'id,title,body,tags,pinned,updated_at'

export async function listNotes(): Promise<Note[]> {
  const { data, error } = await supabase.from('notes').select(columns).is('deleted_at', null)
  if (error) throw error
  return data as Note[]
}

export async function createNote(changes: NoteChanges = {}): Promise<Note> {
  const { data, error } = await supabase.from('notes').insert(changes).select(columns).single()
  if (error) throw error
  return data as Note
}

export async function updateNote(id: string, changes: NoteChanges): Promise<void> {
  const { error } = await supabase.from('notes').update(changes).eq('id', id)
  if (error) throw error
}

// Soft delete, so other devices learn about it when they sync
export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
