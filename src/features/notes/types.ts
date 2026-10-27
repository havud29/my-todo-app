// A row of public.notes
export interface Note {
  id: string
  title: string
  body: string
  tags: string[]
  pinned: boolean
  updated_at: string
}

export type NoteChanges = Partial<Pick<Note, 'title' | 'body' | 'tags' | 'pinned'>>
