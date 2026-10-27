import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { createTask, deleteTask, listTasks, updateTask } from './api'
import type { Task, TaskInput } from './types'

// All of the user's tasks, kept live. Edits show at once and roll back by
// reloading if the server refuses them.
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setTasks(await listTasks())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => reload())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [reload])

  const guard = useCallback(
    async (work: Promise<unknown>) => {
      try {
        await work
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save')
        await reload()
      }
    },
    [reload],
  )

  const add = useCallback(async (input: TaskInput) => {
    const task = await createTask(input)
    setTasks((ts) => (ts.some((t) => t.id === task.id) ? ts : [...ts, task]))
  }, [])

  const patch = useCallback(
    (id: string, changes: Partial<Task>) => {
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...changes } : t)))
      return guard(updateTask(id, changes))
    },
    [guard],
  )

  const toggle = useCallback(
    (task: Task) => patch(task.id, { done: !task.done, done_at: task.done ? null : new Date().toISOString() }),
    [patch],
  )

  const remove = useCallback(
    (id: string) => {
      setTasks((ts) => ts.filter((t) => t.id !== id))
      return guard(deleteTask(id))
    },
    [guard],
  )

  return { tasks, loading, error, reload, add, patch, toggle, remove }
}
