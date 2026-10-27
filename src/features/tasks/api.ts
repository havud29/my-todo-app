import { supabase } from '../../lib/supabase'
import type { Task, TaskInput } from './types'

const columns = 'id,title,notes,list,done,done_at,due_at,priority,sort_order,created_at'

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').select(columns).is('deleted_at', null).order('created_at')
  if (error) throw error
  return data as Task[]
}

export async function createTask(input: TaskInput): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...input, sort_order: Date.now() })
    .select(columns)
    .single()
  if (error) throw error
  return data as Task
}

export async function updateTask(id: string, patch: Partial<Omit<Task, 'id' | 'created_at'>>): Promise<void> {
  const { error } = await supabase.from('tasks').update(patch).eq('id', id)
  if (error) throw error
}

// Soft delete, so other devices learn about it when they sync
export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
