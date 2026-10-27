import { useSyncExternalStore } from 'react'
import { format } from 'date-fns'
import type { Budget, Txn } from './types'

export const currencies = ['VND', 'USD', 'EUR', 'GBP', 'AUD', 'JPY', 'SGD']

// A first guess from the browser language; the user can change it on the page
function guessCurrency(): string {
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('vi')) return 'VND'
  if (lang === 'en-gb') return 'GBP'
  if (lang === 'en-au') return 'AUD'
  if (lang.startsWith('ja')) return 'JPY'
  if (lang === 'en-sg') return 'SGD'
  if (/^(de|fr|es|it|nl|pt|fi)/.test(lang)) return 'EUR'
  return 'USD'
}

const key = 'currency'
const listeners = new Set<() => void>()
let current = guessCurrency()
try {
  const c = localStorage.getItem(key)
  if (c && currencies.includes(c)) current = c
} catch {
  // storage can be blocked; keep the guess
}

export function setCurrency(c: string) {
  current = c
  try {
    localStorage.setItem(key, c)
  } catch {
    // not saved, still used for this visit
  }
  listeners.forEach((l) => l())
}

export const useCurrency = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )

export const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)

// Reads "45000", "45,000", "45k" or "1.5m". Returns null if it isn't a positive amount.
export function parseAmount(text: string): number | null {
  const m = text.trim().toLowerCase().replace(/[\s,]/g, '').match(/^(\d*\.?\d+)([km]?)$/)
  if (!m) return null
  const n = Number(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1)
  return n > 0 ? Math.round(n * 100) / 100 : null
}

export const monthKey = (d: Date) => format(d, 'yyyy-MM')
export const inMonth = (t: Txn, month: string) => t.occurred_on.startsWith(month)

export interface CategoryLine {
  category: string
  spent: number
  limit: number | null
  budgetId: string | null
}

// Spending per expense category this month, joined with its limit. Budgeted
// categories come first, then the rest by amount spent.
export function categoryLines(txns: Txn[], budgets: Budget[], month: string): CategoryLine[] {
  const lines = new Map<string, CategoryLine>()
  for (const b of budgets) {
    lines.set(b.category.toLowerCase(), { category: b.category, spent: 0, limit: b.monthly_limit, budgetId: b.id })
  }
  for (const t of txns) {
    if (t.kind !== 'expense' || !inMonth(t, month)) continue
    const k = t.category.toLowerCase()
    const line = lines.get(k) ?? { category: t.category, spent: 0, limit: null, budgetId: null }
    line.spent += t.amount
    lines.set(k, line)
  }
  return [...lines.values()].sort(
    (a, b) => Number(b.limit !== null) - Number(a.limit !== null) || b.spent - a.spent || a.category.localeCompare(b.category),
  )
}

export function totals(txns: Txn[], month: string) {
  let income = 0
  let spent = 0
  for (const t of txns) {
    if (!inMonth(t, month)) continue
    if (t.kind === 'income') income += t.amount
    else spent += t.amount
  }
  return { income, spent, net: income - spent }
}
