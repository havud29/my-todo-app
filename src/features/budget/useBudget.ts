import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  createBudget,
  createTransaction,
  deleteBudget,
  deleteTransaction,
  listBudgets,
  listTransactions,
  updateBudget,
  updateTransaction,
} from './api'
import type { Budget, Txn, TxnInput } from './types'

// All of the user's transactions and budgets, kept live. Edits show at once
// and roll back by reloading if the server refuses them.
export function useBudget() {
  const [txns, setTxns] = useState<Txn[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [t, b] = await Promise.all([listTransactions(), listBudgets()])
      setTxns(t)
      setBudgets(b)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your budget')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const channel = supabase
      .channel('budget-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => reload())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [reload])

  const guard = useCallback(
    async (work: Promise<unknown>) => {
      try {
        await work
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save')
        await reload()
      }
    },
    [reload],
  )

  const add = useCallback(
    (input: TxnInput) =>
      guard(
        createTransaction(input).then((t) => setTxns((ts) => (ts.some((x) => x.id === t.id) ? ts : [...ts, t]))),
      ),
    [guard],
  )

  const patch = useCallback(
    (id: string, changes: Partial<TxnInput>) => {
      setTxns((ts) => ts.map((t) => (t.id === id ? { ...t, ...changes } : t)))
      return guard(updateTransaction(id, changes))
    },
    [guard],
  )

  const remove = useCallback(
    (id: string) => {
      setTxns((ts) => ts.filter((t) => t.id !== id))
      return guard(deleteTransaction(id))
    },
    [guard],
  )

  // Sets the limit for a category, creating the budget if there is none
  const setLimit = useCallback(
    (category: string, limit: number) => {
      const existing = budgets.find((b) => b.category.toLowerCase() === category.toLowerCase())
      if (existing) {
        setBudgets((bs) => bs.map((b) => (b.id === existing.id ? { ...b, category, monthly_limit: limit } : b)))
        return guard(updateBudget(existing.id, { category, monthly_limit: limit }))
      }
      return guard(
        createBudget(category, limit).then((b) => setBudgets((bs) => (bs.some((x) => x.id === b.id) ? bs : [...bs, b]))),
      )
    },
    [budgets, guard],
  )

  const removeBudget = useCallback(
    (id: string) => {
      setBudgets((bs) => bs.filter((b) => b.id !== id))
      return guard(deleteBudget(id))
    },
    [guard],
  )

  return { txns, budgets, loading, error, reload, add, patch, remove, setLimit, removeBudget }
}
