import { useEffect, useRef, useState } from 'react'
import { parseAmount } from './money'
import { expenseCategories, incomeCategories, type Kind, type Txn, type TxnInput } from './types'

interface Props {
  txn: Txn
  categories: string[]
  onSave: (changes: TxnInput) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

// Edits one transaction. Reuses the event dialog's look so every theme styles it.
export default function TxnDialog({ txn, categories, onSave, onDelete, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [kind, setKind] = useState<Kind>(txn.kind)
  const [amount, setAmount] = useState(String(txn.amount))
  const [category, setCategory] = useState(txn.category)
  const [note, setNote] = useState(txn.note)
  const [date, setDate] = useState(txn.occurred_on)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const value = parseAmount(amount)
  const suggestions = [...new Set([...(kind === 'expense' ? expenseCategories : incomeCategories), ...categories])]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (value === null || !date) return
    setSaving(true)
    await onSave({ kind, amount: value, category: category.trim() || 'Other', note: note.trim(), occurred_on: date })
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
      className={`event-dialog budget-dialog ${kind === 'income' ? 'c-green' : 'c-rose'}`}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <form onSubmit={submit}>
        <header className="win-title">
          <span className="win-title-text">Edit {kind === 'income' ? 'income' : 'expense'}</span>
          <span className="win-controls">
            <button type="button" className="win-btn close" onClick={() => dialog.current?.close()} aria-label="Close" />
          </span>
        </header>
        <div className="dialog-accent" />

        <div className="segmented" role="radiogroup" aria-label="Type">
          {(['expense', 'income'] as Kind[]).map((k) => (
            <button type="button" key={k} role="radio" aria-checked={kind === k} aria-selected={kind === k} onClick={() => setKind(k)}>
              {k === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>

        <label className="field">
          <span className="field-label">Amount</span>
          <input
            className="title-input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={value === null}
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field-label">Category</span>
          <input list="txn-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="txn-categories">
            {suggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span className="field-label">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <textarea placeholder="Note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />

        <div className="dialog-actions">
          <button type="button" className={confirmDelete ? 'danger solid' : 'danger'} onClick={remove} disabled={saving}>
            {confirmDelete ? 'Really delete?' : 'Delete'}
          </button>
          <span className="spacer" />
          <button type="button" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving || value === null}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  )
}
