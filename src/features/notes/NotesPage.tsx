import { useRef, useState } from 'react'
import { format, isThisYear, isToday } from 'date-fns'
import Window from '../../components/Window'
import NoteEditor from './NoteEditor'
import { useNotes } from './useNotes'
import type { Note } from './types'
import './notes.css'

const stamp = (iso: string) => {
  const d = new Date(iso)
  return format(d, isToday(d) ? 'HH:mm' : isThisYear(d) ? 'd MMM' : 'd MMM yyyy')
}

const snippet = (n: Note) => n.body.replace(/\s+/g, ' ').trim().slice(0, 90)

// Pinned first, then most recently edited
const order = (a: Note, b: Note) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at)

export default function NotesPage() {
  const { notes, loading, error, reload, add, patch, remove } = useNotes()
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  // Notes the editor has saved changes to, so a just-typed note is never
  // mistaken for an empty one before its state catches up
  const touched = useRef(new Set<string>())

  const q = query.trim().toLowerCase()
  const shown = notes
    .filter((n) => !tag || n.tags.includes(tag))
    .filter((n) => !q || `${n.title}\n${n.body}\n${n.tags.join(' ')}`.toLowerCase().includes(q))
    .sort(order)
  const tags = [...new Set(notes.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b))
  const open = notes.find((n) => n.id === openId) ?? null

  // Leaving a note that was never written in throws it away
  const close = (next: string | null) => {
    const blank = open && !open.title.trim() && !open.body.trim() && open.tags.length === 0
    if (open && open.id !== next && blank && !touched.current.has(open.id)) remove(open.id)
    setOpenId(next)
  }

  const newNote = async () => {
    const note = await add(tag ? { tags: [tag] } : {})
    close(note.id)
  }

  return (
    <Window title="Notes - My To-do" icon="notes" className="notes-window">
      <div className={`notes ${open ? 'has-open' : ''}`}>
        <aside className="note-list-pane">
          <div className="note-list-head">
            <h1 className="cal-title">Notes</h1>
            <button className="primary" onClick={newNote}>
              + New
            </button>
          </div>
          <input
            className="note-search"
            type="search"
            placeholder="Search notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search notes"
          />
          {tags.length > 0 && (
            <div className="note-filter">
              {tags.map((t) => (
                <button key={t} className="note-chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                  #{t}
                </button>
              ))}
            </div>
          )}
          {error && (
            <div className="banner">
              Couldn't sync your notes: {error} <button onClick={reload}>Retry</button>
            </div>
          )}
          <ul className="note-list">
            {shown.map((n) => (
              <li key={n.id}>
                <button className="note-item" aria-current={n.id === openId} onClick={() => close(n.id)}>
                  <span className="note-item-title">
                    {n.pinned && <span className="note-item-pin">📌</span>}
                    {n.title.trim() || 'Untitled'}
                  </span>
                  <span className="note-item-meta">
                    <span className="note-item-date">{stamp(n.updated_at)}</span>
                    <span className="note-item-snippet">{snippet(n) || 'No text'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!loading && shown.length === 0 && (
            <p className="note-empty">{notes.length === 0 ? 'No notes yet. Start one with + New.' : 'Nothing matches.'}</p>
          )}
        </aside>

        <section className="note-pane">
          {open ? (
            <NoteEditor
              key={open.id}
              note={open}
              onChange={(changes) => {
                touched.current.add(open.id)
                patch(open.id, changes)
              }}
              onDelete={() => {
                remove(open.id)
                setOpenId(null)
              }}
              onBack={() => close(null)}
            />
          ) : (
            <div className="note-placeholder">
              <p>Pick a note, or start a new one.</p>
              <button className="primary" onClick={newNote}>
                + New note
              </button>
            </div>
          )}
        </section>
      </div>
    </Window>
  )
}
