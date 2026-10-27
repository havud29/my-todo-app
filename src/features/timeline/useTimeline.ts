import { useCallback, useEffect, useMemo, useState } from 'react'
import { addMonths, isBefore, parseISO, startOfDay } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { listEvents } from '../calendar/api'
import { expandOccurrences } from '../calendar/occurrences'
import { occurrenceTimeLabel } from '../calendar/format'
import type { CalendarEvent } from '../calendar/types'
import { listTasks, updateTask } from '../tasks/api'
import type { Task } from '../tasks/types'
import { listMilestones } from '../milestones/api'
import type { Milestone } from '../milestones/types'

export type ItemKind = 'event' | 'task' | 'milestone'

export interface TimelineItem {
  key: string
  kind: ItemKind
  date: Date
  title: string
  detail: string
  color: string
  overdue?: boolean
  task?: Task
}

// Everything dated from today until `months` ahead, plus overdue tasks, in
// time order. Milestones are optional so the page still works before the
// milestones migration has been run.
export function useTimeline(months: number) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const today = startOfDay(new Date()).getTime()
  const end = addMonths(new Date(today), months).getTime()

  const reload = useCallback(async () => {
    try {
      const [es, ts, ms] = await Promise.all([
        listEvents(new Date(today), new Date(end)),
        listTasks(),
        listMilestones().catch(() => [] as Milestone[]),
      ])
      setEvents(es)
      setTasks(ts)
      setMilestones(ms)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your timeline')
    } finally {
      setLoading(false)
    }
  }, [today, end])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const channel = supabase.channel('timeline-changes')
    for (const table of ['events', 'tasks', 'milestones']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => reload())
    }
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [reload])

  const items = useMemo(() => {
    const from = new Date(today)
    const to = new Date(end)
    const out: TimelineItem[] = []
    for (const o of expandOccurrences(events, from, to)) {
      // Something already underway shows on today
      const date = isBefore(o.start, from) ? from : o.start
      out.push({
        key: `e-${o.key}`,
        kind: 'event',
        date,
        title: o.event.title,
        detail: [occurrenceTimeLabel(o, date), o.event.location].filter(Boolean).join(' · '),
        color: o.event.color ?? 'violet',
      })
    }
    for (const t of tasks) {
      if (t.done || !t.due_at) continue
      const due = new Date(t.due_at)
      if (!isBefore(due, to)) continue
      out.push({
        key: `t-${t.id}`,
        kind: 'task',
        date: due,
        title: t.title,
        detail: [t.priority ? '!'.repeat(t.priority) : '', t.list].filter(Boolean).join(' · '),
        color: 'blue',
        overdue: isBefore(due, from),
        task: t,
      })
    }
    for (const m of milestones) {
      if (m.achieved_at || !m.target_date) continue
      const target = parseISO(m.target_date)
      if (!isBefore(target, to)) continue
      out.push({
        key: `m-${m.id}`,
        kind: 'milestone',
        date: target,
        title: `${m.emoji} ${m.title}`,
        detail: 'Milestone target',
        color: m.color,
        overdue: isBefore(target, from),
      })
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [events, tasks, milestones, today, end])

  const completeTask = useCallback(
    async (task: Task) => {
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, done: true } : t)))
      try {
        await updateTask(task.id, { done: true, done_at: new Date().toISOString() })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save')
        await reload()
      }
    },
    [reload],
  )

  return { items, loading, error, reload, completeTask }
}
