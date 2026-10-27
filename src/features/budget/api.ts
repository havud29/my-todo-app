import { supabase } from '../../lib/supabase'
import type { Budget, Txn, TxnInput } from './types'

const txnColumns = 'id,kind,amount,category,note,occurred_on,updated_at'
const budgetColumns = 'id,category,monthly_limit'

// numeric columns can arrive as strings; keep them as numbers in the app
const toTxn = (r: Txn): Txn => ({ ...r, amount: Number(r.amount) })
const toBudget = (r: Budget): Budget => ({ ...r, monthly_limit: Number(r.monthly_limit) })

export async function listTransactions(): Promise<Txn[]> {
  const { data, error } = await supabase.from('transactions').select(txnColumns).is('deleted_at', null)
  if (error) throw error
  return (data as Txn[]).map(toTxn)
}

export async function createTransaction(input: TxnInput): Promise<Txn> {
  const { data, error } = await supabase.from('transactions').insert(input).select(txnColumns).single()
  if (error) throw error
  return toTxn(data as Txn)
}

export async function updateTransaction(id: string, changes: Partial<TxnInput>): Promise<void> {
  const { error } = await supabase.from('transactions').update(changes).eq('id', id)
  if (error) throw error
}

// Soft delete, so other devices learn about it when they sync
export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function listBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase.from('budgets').select(budgetColumns).is('deleted_at', null)
  if (error) throw error
  return (data as Budget[]).map(toBudget)
}

export async function createBudget(category: string, monthly_limit: number): Promise<Budget> {
  const { data, error } = await supabase.from('budgets').insert({ category, monthly_limit }).select(budgetColumns).single()
  if (error) throw error
  return toBudget(data as Budget)
}

export async function updateBudget(id: string, changes: Partial<Omit<Budget, 'id'>>): Promise<void> {
  const { error } = await supabase.from('budgets').update(changes).eq('id', id)
  if (error) throw error
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
