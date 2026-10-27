import { useEffect, useRef, useState } from 'react'
import { format, parse, startOfDay } from 'date-fns'
import { priorityLabels, type Priority, type Task } from './types'

interface Props {
  task: Task
  lists: string[]
  onSave: (changes: Partial<Task>) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

const dateFmt = 'yyyy-MM-dd'

// Edits one task. Reuses the event dialog's look so every theme styles it.
export default function TaskDialog({ task, lists, onSave, onDelete, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [list, setList] = useState(task.list)
  const [newList, setNewList] = useState('')
  const [due, setDue] = useState(task.due_at ? format(new Date(task.due_at), dateFmt) : '')
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave({
      title: title.trim() || 'Untitled',
      notes: notes.trim(),
      list: list === '__new' ? newList.trim() || 'Inbox' : list,
      due_at: due ? startOfDay(parse(due, dateFmt, new Date())).toISOString() : null,
      priority,
    })
    dialog.current?.close()
  }

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true)
    setSaving(true)
    await onDelete()
    dialog.current?.close()
  }

  return (
    <dialog
      ref={dialog}
      className="event-dialog task-dialog c-violet"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <form onSubmit={submit}>
        <header className="win-title">
          <span className="win-title-text">Edit task</span>
          <span className="win-controls">
            <button type="button" className="win-btn close" onClick={() => dialog.current?.close()} aria-label="Close" />
          </span>
        </header>
        <div className="dialog-accent" />
        <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

        <div className="field">
          <span className="field-label">Due</span>
          <div className="due-row">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            {due && (
              <button type="button" className="link-btn" onClick={() => setDue('')}>
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Priority</span>
          <div className="segmented" role="radiogroup" aria-label="Priority">
            {([0, 1, 2, 3] as Priority[]).map((p) => (
              <button
                type="button"
                key={p}
                role="radio"
                aria-checked={priority === p}
                aria-selected={priority === p}
                className={`prio-${p}`}
                onClick={() => setPriority(p)}
              >
                {priorityLabels[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">List</span>
          <select value={list} onChange={(e) => setList(e.target.value)}>
            {lists.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
            <option value="__new">New list…</option>
          </select>
          {list === '__new' && (
            <input placeholder="List name" value={newList} onChange={(e) => setNewList(e.target.value)} autoFocus />
          )}
        </div>

        <textarea placeholder="Notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="dialog-actions">
          <button type="button" className={confirmDelete ? 'danger solid' : 'danger'} onClick={remove} disabled={saving}>
            {confirmDelete ? 'Really delete?' : 'Delete'}
          </button>
          <span className="spacer" />
          <button type="button" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  )
}
