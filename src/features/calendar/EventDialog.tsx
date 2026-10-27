import { useEffect, useRef, useState } from 'react'
import { addHours, format, parse, startOfDay } from 'date-fns'
import { eventColors, repeatLabels, type CalendarEvent, type EventColor, type EventInput, type Repeat } from './types'

interface Props {
  // An existing event to edit, or the start time for a new one
  target: { event: CalendarEvent } | { start: Date; allDay?: boolean }
  onSave: (input: EventInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

const dateFmt = 'yyyy-MM-dd'
const timeFmt = 'HH:mm'
const toDate = (date: string, time = '00:00') => parse(`${date} ${time}`, `${dateFmt} ${timeFmt}`, new Date())

function initialState(target: Props['target']) {
  if ('event' in target) {
    const e = target.event
    const start = new Date(e.starts_at)
    const end = e.ends_at ? new Date(e.ends_at) : e.all_day ? start : addHours(start, 1)
    return {
      title: e.title,
      allDay: e.all_day,
      startDate: format(start, dateFmt),
      startTime: format(start, timeFmt),
      endDate: format(end, dateFmt),
      endTime: format(end, timeFmt),
      repeat: (e.recurrence ?? '') as Repeat,
      color: (e.color ?? 'violet') as EventColor,
      location: e.location ?? '',
      description: e.description,
    }
  }
  const start = target.start
  const end = addHours(start, 1)
  return {
    title: '',
    allDay: target.allDay ?? false,
    startDate: format(start, dateFmt),
    startTime: format(start, timeFmt),
    endDate: format(end, dateFmt),
    endTime: format(end, timeFmt),
    repeat: '' as Repeat,
    color: 'violet' as EventColor,
    location: '',
    description: '',
  }
}

export default function EventDialog({ target, onSave, onDelete, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState(() => initialState(target))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editing = 'event' in target

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Keep the end after the start when the start moves
  const setStartDate = (v: string) =>
    setForm((f) => ({ ...f, startDate: v, endDate: f.endDate < v ? v : f.endDate }))
  const setStartTime = (v: string) =>
    setForm((f) => {
      if (f.endDate !== f.startDate || f.endTime > v) return { ...f, startTime: v }
      const end = addHours(toDate(f.startDate, v), 1)
      return { ...f, startTime: v, endDate: format(end, dateFmt), endTime: format(end, timeFmt) }
    })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const start = form.allDay ? startOfDay(toDate(form.startDate)) : toDate(form.startDate, form.startTime)
    const end = form.allDay ? startOfDay(toDate(form.endDate)) : toDate(form.endDate, form.endTime)
    if (end < start) return setError('The end must be after the start.')

    setSaving(true)
    setError(null)
    try {
      await onSave({
        title: form.title.trim() || 'Untitled',
        description: form.description.trim(),
        location: form.location.trim() || null,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        all_day: form.allDay,
        recurrence: form.repeat || null,
        color: form.color,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true)
    setSaving(true)
    try {
      await onDelete?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete')
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      className={`event-dialog c-${form.color}`}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <form onSubmit={submit}>
        <header className="win-title">
          <span className="win-title-text">{editing ? 'Edit event' : 'New event'}</span>
          <span className="win-controls">
            <button type="button" className="win-btn close" onClick={() => dialog.current?.close()} aria-label="Close" />
          </span>
        </header>
        <div className="dialog-accent" />
        <input
          className="title-input"
          placeholder="What are you working on?"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          autoFocus
        />

        <label className="switch">
          <input type="checkbox" checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} />
          <span className="track" />
          All day
        </label>

        <div className="when">
          <div className="when-row">
            <span className="when-label">Starts</span>
            <input type="date" required value={form.startDate} onChange={(e) => setStartDate(e.target.value)} />
            {!form.allDay && (
              <input type="time" required value={form.startTime} onChange={(e) => setStartTime(e.target.value)} />
            )}
          </div>
          <div className="when-row">
            <span className="when-label">Ends</span>
            <input
              type="date"
              required
              min={form.startDate}
              value={form.endDate}
              onChange={(e) => set('endDate', e.target.value)}
            />
            {!form.allDay && (
              <input type="time" required value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
            )}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Repeat</span>
          <select value={form.repeat} onChange={(e) => set('repeat', e.target.value as Repeat)}>
            {Object.entries(repeatLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field-label">Color</span>
          <div className="swatches">
            {eventColors.map((c) => (
              <button
                type="button"
                key={c}
                className={`swatch c-${c} ${form.color === c ? 'on' : ''}`}
                onClick={() => set('color', c)}
                aria-label={c}
                aria-pressed={form.color === c}
              />
            ))}
          </div>
        </div>

        <input
          className="plain-input"
          placeholder="Location"
          value={form.location}
          onChange={(e) => set('location', e.target.value)}
        />
        <textarea
          className="plain-input"
          placeholder="Notes"
          rows={3}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />

        {editing && form.repeat && <p className="hint">Changes apply to every repeat of this event.</p>}
        {error && <p className="form-error">{error}</p>}

        <div className="dialog-actions">
          {editing && onDelete && (
            <button type="button" className={confirmDelete ? 'danger solid' : 'danger'} onClick={remove} disabled={saving}>
              {confirmDelete ? 'Really delete?' : 'Delete'}
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={() => dialog.current?.close()} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
