import { useEffect, useRef, useState } from 'react'
import { eventColors } from '../calendar/types'
import { milestoneEmojis, type Milestone, type MilestoneInput } from './types'

interface Props {
  milestone?: Milestone
  onSave: (input: MilestoneInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

// Creates or edits a milestone. Reuses the event dialog's look so every theme
// styles it.
export default function MilestoneDialog({ milestone, onSave, onDelete, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState<MilestoneInput>({
    title: milestone?.title ?? '',
    description: milestone?.description ?? '',
    emoji: milestone?.emoji ?? '🎯',
    color: milestone?.color ?? 'violet',
    target_date: milestone?.target_date ?? null,
  })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const set = <K extends keyof MilestoneInput>(key: K, value: MilestoneInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  const run = async (work: () => Promise<void>) => {
    setSaving(true)
    setError(null)
    try {
      await work()
      dialog.current?.close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      setSaving(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(() => onSave({ ...form, title: form.title.trim() || 'Untitled goal', description: form.description.trim() }))
  }

  return (
    <dialog
      ref={dialog}
      className={`event-dialog milestone-dialog c-${form.color}`}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <form onSubmit={submit}>
        <header className="win-title">
          <span className="win-title-text">{milestone ? 'Edit milestone' : 'New milestone'}</span>
          <span className="win-controls">
            <button type="button" className="win-btn close" onClick={() => dialog.current?.close()} aria-label="Close" />
          </span>
        </header>
        <div className="dialog-accent" />
        <input
          className="title-input"
          placeholder="What are you working towards?"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          autoFocus
        />

        <div className="field">
          <span className="field-label">Icon</span>
          <div className="emoji-grid" role="radiogroup" aria-label="Icon">
            {milestoneEmojis.map((em) => (
              <button
                type="button"
                key={em}
                role="radio"
                aria-checked={form.emoji === em}
                className={`emoji-pick ${form.emoji === em ? 'on' : ''}`}
                onClick={() => set('emoji', em)}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Target date</span>
          <input type="date" value={form.target_date ?? ''} onChange={(e) => set('target_date', e.target.value || null)} />
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

        <textarea
          placeholder="Why it matters, or what done looks like"
          rows={3}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />

        {error && <p className="form-error">{error}</p>}

        <div className="dialog-actions">
          {onDelete && (
            <button
              type="button"
              className={confirmDelete ? 'danger solid' : 'danger'}
              disabled={saving}
              onClick={() => (confirmDelete ? run(onDelete) : setConfirmDelete(true))}
            >
              {confirmDelete ? 'Really delete?' : 'Delete'}
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {milestone ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
