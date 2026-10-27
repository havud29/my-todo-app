export type Kind = 'expense' | 'income'

// A row of public.transactions
export interface Txn {
  id: string
  kind: Kind
  amount: number
  category: string
  note: string
  occurred_on: string // yyyy-MM-dd
  updated_at: string
}

export type TxnInput = Pick<Txn, 'kind' | 'amount' | 'category' | 'note' | 'occurred_on'>

// A row of public.budgets: how much may be spent on a category each month
export interface Budget {
  id: string
  category: string
  monthly_limit: number
}

export const expenseCategories = ['Food', 'Transport', 'Housing', 'Bills', 'Shopping', 'Health', 'Fun', 'Other']
export const incomeCategories = ['Salary', 'Freelance', 'Gift', 'Other']
