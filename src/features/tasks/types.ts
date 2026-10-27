export type Priority = 0 | 1 | 2 | 3

export const priorityLabels: Record<Priority, string> = { 0: 'None', 1: 'Low', 2: 'Medium', 3: 'High' }

// A row of public.tasks
export interface Task {
  id: string
  title: string
  notes: string
  list: string
  done: boolean
  done_at: string | null
  due_at: string | null
  priority: Priority
  sort_order: number
  created_at: string
}

export type TaskInput = Pick<Task, 'title' | 'notes' | 'list' | 'due_at' | 'priority'>

// Built-in views, plus any list name the user has made
export type TaskView = { kind: 'today' } | { kind: 'upcoming' } | { kind: 'all' } | { kind: 'list'; name: string }
