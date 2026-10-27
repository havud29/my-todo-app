import { useState } from 'react'
import { addMonths, format, isThisMonth, isToday, isYesterday, parseISO } from 'date-fns'
import Window from '../../components/Window'
import LimitDialog from './LimitDialog'
import TxnDialog from './TxnDialog'
import { useBudget } from './useBudget'
import { categoryLines, currencies, formatMoney, inMonth, monthKey, parseAmount, setCurrency, totals, useCurrency } from './money'
import { expenseCategories, incomeCategories, type Kind, type Txn } from './types'
import './budget.css'

const dayLabel = (iso: string) => {
  const d = parseISO(iso)
  return isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE d MMMM')
}

export default function BudgetPage() {
  const { txns, budgets, loading, error, reload, add, patch, remove, setLimit, removeBudget } = useBudget()
  const currency = useCurrency()
  const money = (n: number) => formatMoney(n, currency)

  const [month, setMonth] = useState(() => new Date())
  const [filter, setFilter] = useState<string | null>(null)
  const [kind, setKind] = useState<Kind>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(expenseCategories[0])
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Txn | null>(null)
  const [limitFor, setLimitFor] = useState<{ category: string; limit: number | null; budgetId: string | null } | null>(null)

  const key = monthKey(month)
  const sum = totals(txns, key)
  const lines = categoryLines(txns, budgets, key)
  const budgeted = lines.filter((l) => l.limit !== null)
  const totalLimit = budgeted.reduce((s, l) => s + l.limit!, 0)
  const budgetedSpent = budgeted.reduce((s, l) => s + l.spent, 0)

  const used = [...new Set(txns.filter((t) => t.kind === kind).map((t) => t.category))]
  const choices = [...new Set([...(kind === 'expense' ? expenseCategories : incomeCategories), ...used])]
  const allCategories = [...new Set(txns.map((t) => t.category))]

  const shown = txns
    .filter((t) => inMonth(t, key) && (!filter || t.category.toLowerCase() === filter.toLowerCase()))
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.updated_at.localeCompare(a.updated_at))
  const days = Object.entries(
    shown.reduce<Record<string, Txn[]>>((acc, t) => {
      ;(acc[t.occurred_on] ??= []).push(t)
      return acc
    }, {}),
  )

  const switchKind = (k: Kind) => {
    setKind(k)
    setCategory((k === 'expense' ? expenseCategories : incomeCategories)[0])
  }

  const value = parseAmount(amount)
  const quickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (value === null) return
    setAdding(true)
    try {
      await add({
        kind,
        amount: value,
        category,
        note: note.trim(),
        // new entries land on today, or on the first of the month being viewed
        occurred_on: format(isThisMonth(month) ? new Date() : month, isThisMonth(month) ? 'yyyy-MM-dd' : 'yyyy-MM-01'),
      })
      setAmount('')
      setNote('')
    } finally {
      setAdding(false)
    }
  }

  const pct = (spent: number, limit: number) => Math.min(100, Math.round((spent / limit) * 100))

  return (
    <Window title="Budget - My To-do" icon="budget" className="budget-window">
      <div className="budget">
        <aside className="budget-side">
          <div className="month-switch">
            <button className="icon-btn" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month">
              ‹
            </button>
            <h1 className="cal-title">{format(month, 'MMMM yyyy')}</h1>
            <button className="icon-btn" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
              ›
            </button>
          </div>
          {!isThisMonth(month) && (
            <button className="link-btn this-month" onClick={() => setMonth(new Date())}>
              Back to this month
            </button>
          )}

          <dl className="budget-totals">
            <div className="bt income">
              <dt>Income</dt>
              <dd>{money(sum.income)}</dd>
            </div>
            <div className="bt spent">
              <dt>Spent</dt>
              <dd>{money(sum.spent)}</dd>
            </div>
            <div className={`bt net ${sum.net < 0 ? 'negative' : ''}`}>
              <dt>{sum.net < 0 ? 'Overspent' : 'Left'}</dt>
              <dd>{money(Math.abs(sum.net))}</dd>
            </div>
          </dl>

          <div className="budget-head">
            <h2>Spending by category</h2>
            <button className="link-btn" onClick={() => setLimitFor({ category: '', limit: null, budgetId: null })}>
              + Set budget
            </button>
          </div>

          {totalLimit > 0 && (
            <div className={`limit-line total ${budgetedSpent > totalLimit ? 'over' : ''}`}>
              <div className="ll-row">
                <span className="ll-name">All budgets</span>
                <span className="ll-amount">
                  {money(budgetedSpent)} / {money(totalLimit)}
                </span>
              </div>
              <div className="meter" role="meter" aria-valuenow={pct(budgetedSpent, totalLimit)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${pct(budgetedSpent, totalLimit)}%` }} />
              </div>
            </div>
          )}

          {lines.length === 0 && <p className="budget-empty small">No spending this month yet.</p>}
          <ul className="limit-lines">
            {lines.map((l) => {
              const over = l.limit !== null && l.spent > l.limit
              return (
                <li key={l.category}>
                  <button
                    className={`limit-line ${over ? 'over' : ''}`}
                    aria-pressed={filter?.toLowerCase() === l.category.toLowerCase()}
                    onClick={() => setFilter((f) => (f?.toLowerCase() === l.category.toLowerCase() ? null : l.category))}
                  >
                    <span className="ll-row">
                      <span className="ll-name">{l.category}</span>
                      <span className="ll-amount">{money(l.spent)}</span>
                    </span>
                    {l.limit !== null && (
                      <>
                        <span className="meter" aria-hidden>
                          <span style={{ width: `${pct(l.spent, l.limit)}%` }} />
                        </span>
                        <span className="ll-left">
                          {over ? `${money(l.spent - l.limit)} over` : `${money(l.limit - l.spent)} left of ${money(l.limit)}`}
                        </span>
                      </>
                    )}
                  </button>
                  <button
                    className="link-btn ll-edit"
                    onClick={() => setLimitFor(l)}
                    aria-label={l.limit === null ? `Set a budget for ${l.category}` : `Change the budget for ${l.category}`}
                  >
                    {l.limit === null ? 'Set limit' : 'Edit'}
                  </button>
                </li>
              )
            })}
          </ul>

          <label className="currency-pick">
            Currency
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </aside>

        <section className="budget-panel">
          <form className="money-add" onSubmit={quickAdd}>
            <div className="segmented" role="radiogroup" aria-label="Type">
              {(['expense', 'income'] as Kind[]).map((k) => (
                <button type="button" key={k} role="radio" aria-checked={kind === k} aria-selected={kind === k} onClick={() => switchKind(k)}>
                  {k === 'expense' ? 'Expense' : 'Income'}
                </button>
              ))}
            </div>
            <input
              className="ma-amount"
              inputMode="decimal"
              placeholder="Amount (45k)"
              aria-label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={adding}
            />
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {choices.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              className="ma-note"
              placeholder="What was it for?"
              aria-label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={adding}
            />
            <button className="primary" disabled={adding || value === null}>
              Add
            </button>
          </form>

          {error && (
            <div className="banner">
              Couldn't sync your budget: {error} <button onClick={reload}>Retry</button>
            </div>
          )}

          {filter && (
            <div className="budget-filter">
              Showing <strong>{filter}</strong>
              <button className="link-btn" onClick={() => setFilter(null)}>
                Show all
              </button>
            </div>
          )}

          {!loading && shown.length === 0 && (
            <p className="budget-empty">Nothing recorded {filter ? `for ${filter} ` : ''}in {format(month, 'MMMM')}.</p>
          )}

          {days.map(([day, ts]) => {
            const net = ts.reduce((s, t) => s + (t.kind === 'income' ? t.amount : -t.amount), 0)
            return (
              <div key={day} className="money-day">
                <h2 className="money-day-head">
                  <span>{dayLabel(day)}</span>
                  <span className={net < 0 ? 'neg' : 'pos'}>
                    {net < 0 ? '−' : '+'}
                    {money(Math.abs(net))}
                  </span>
                </h2>
                <ul className="money-list">
                  {ts.map((t) => (
                    <li key={t.id}>
                      <button className={`money-row ${t.kind}`} onClick={() => setEditing(t)}>
                        <span className="mr-cat">{t.category}</span>
                        <span className="mr-note">{t.note}</span>
                        <span className="mr-amount">
                          {t.kind === 'income' ? '+' : '−'}
                          {money(t.amount)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>
      </div>

      {editing && (
        <TxnDialog
          key={editing.id}
          txn={editing}
          categories={allCategories}
          onSave={(changes) => patch(editing.id, changes)}
          onDelete={() => remove(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}

      {limitFor && (
        <LimitDialog
          category={limitFor.category}
          limit={limitFor.limit}
          categories={allCategories}
          onSave={setLimit}
          onDelete={limitFor.budgetId ? () => removeBudget(limitFor.budgetId!) : undefined}
          onClose={() => setLimitFor(null)}
        />
      )}
    </Window>
  )
}
