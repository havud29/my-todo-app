import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import type { Note, NoteChanges } from './types'

interface Props {
  note: Note
  onChange: (changes: NoteChanges) => void
  onDelete: () => void
  onBack: () => void
}

const SAVE_DELAY = 600

// Edits one note and saves a moment after typing stops. Mount it with
// key={note.id} so switching notes starts from that note's text.
export default function NoteEditor({ note, onChange, onDelete, onBack }: Props) {
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [tagDraft, setTagDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pending = useRef<NoteChanges | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const save = useRef(onChange)
  useEffect(() => {
    save.current = onChange
  })

  const flush = () => {
    window.clearTimeout(timer.current)
    if (pending.current) save.current(pending.current)
    pending.current = null
  }

  const queue = (changes: NoteChanges) => {
    pending.current = { ...pending.current, ...changes }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_DELAY)
  }

  // Save whatever is left when switching notes or leaving the page
  useEffect(() => flush, [])

  const addTag = () => {
    const tag = tagDraft.trim().replace(/^#/, '')
    setTagDraft('')
    if (tag && !note.tags.includes(tag)) onChange({ tags: [...note.tags, tag] })
  }

  return (
    <article className="note-editor">
      <div className="note-toolbar">
        <button className="link-btn note-back" onClick={() => { flush(); onBack() }}>
          ‹ Notes
        </button>
        <span className="note-saved">Edited {format(new Date(note.updated_at), 'd MMM, HH:mm')}</span>
        <button
          className={`icon-btn note-pin ${note.pinned ? 'on' : ''}`}
          onClick={() => onChange({ pinned: !note.pinned })}
          aria-pressed={note.pinned}
          aria-label={note.pinned ? 'Unpin' : 'Pin to top'}
          title={note.pinned ? 'Unpin' : 'Pin to top'}
        >
          📌
        </button>
        <button
          className={confirmDelete ? 'danger solid' : 'danger'}
          onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          onBlur={() => setConfirmDelete(false)}
        >
          {confirmDelete ? 'Really delete?' : 'Delete'}
        </button>
      </div>

      <input
        className="note-title"
        placeholder="Title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          queue({ title: e.target.value })
        }}
        onBlur={flush}
      />

      <div className="note-tags">
        {note.tags.map((t) => (
          <span key={t} className="note-tag">
            #{t}
            <button onClick={() => onChange({ tags: note.tags.filter((x) => x !== t) })} aria-label={`Remove tag ${t}`}>
              ×
            </button>
          </span>
        ))}
        <input
          className="tag-input"
          placeholder="+ tag"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              addTag()
            }
          }}
          onBlur={addTag}
          aria-label="Add tag"
        />
      </div>

      <textarea
        className="note-body"
        placeholder="Start writing…"
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          queue({ body: e.target.value })
        }}
        onBlur={flush}
        autoFocus={!note.title && !note.body}
      />
    </article>
  )
}
