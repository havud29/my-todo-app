import { useEffect, useRef, useState } from 'react'
import { parseAmount } from './money'
import { expenseCategories } from './types'

interface Props {
  category: string
  limit: number | null
  categories: string[]
  onSave: (category: string, limit: number) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

// Sets how much may be spent on a category each month
export default function LimitDialog({ category: start, limit, categories, onSave, onDelete, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [category, setCategory] = useState(start)
  const [amount, setAmount] = useState(limit ? String(limit) : '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const value = parseAmount(amount)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (value === null || !category.trim()) return
    setSaving(true)
    await onSave(category.trim(), value)
    dialog.current?.close()
  }

  const remove = async () => {
    setSaving(true)
    await onDelete?.()
    dialog.current?.close()
  }

  return (
    <dialog
      ref={dialog}
      className="event-dialog budget-dialog c-blue"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <form onSubmit={submit}>
        <header className="win-title">
          <span className="win-title-text">Monthly budget</span>
          <span className="win-controls">
            <button type="button" className="win-btn close" onClick={() => dialog.current?.close()} aria-label="Close" />
          </span>
        </header>
        <div className="dialog-accent" />

        <label className="field">
          <span className="field-label">Category</span>
          <input
            list="limit-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            readOnly={!!onDelete}
            autoFocus={!start}
          />
          <datalist id="limit-categories">
            {[...new Set([...expenseCategories, ...categories])].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span className="field-label">Per month</span>
          <input
            className="title-input"
            inputMode="decimal"
            placeholder="e.g. 3m or 400"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus={!!start}
          />
        </label>

        <div className="dialog-actions">
          {onDelete && (
            <button type="button" className="danger" onClick={remove} disabled={saving}>
              Remove limit
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving || value === null || !category.trim()}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  )
}
