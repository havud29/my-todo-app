import { addDays, format, isBefore, isSameDay, isToday, isTomorrow, nextDay, startOfDay, type Day } from 'date-fns'
import type { Priority, Task, TaskInput, TaskView } from './types'

export const DEFAULT_LIST = 'Inbox'

export function viewTitle(view: TaskView) {
  if (view.kind === 'list') return view.name
  return { today: 'Today', upcoming: 'Upcoming', all: 'All tasks' }[view.kind]
}

const today = () => startOfDay(new Date())
const due = (t: Task) => (t.due_at ? new Date(t.due_at) : null)

export function isOverdue(t: Task) {
  const d = due(t)
  return !t.done && d !== null && isBefore(d, today())
}

// Open tasks first by priority, then by due date (undated last), then by age
export function byImportance(a: Task, b: Task) {
  if (a.priority !== b.priority) return b.priority - a.priority
  const da = due(a)?.getTime() ?? Infinity
  const db = due(b)?.getTime() ?? Infinity
  if (da !== db) return da - db
  return a.sort_order - b.sort_order
}

export function openTasks(tasks: Task[], view: TaskView): Task[] {
  const end = addDays(today(), 1)
  const open = tasks.filter((t) => !t.done)
  const picked =
    view.kind === 'today'
      ? open.filter((t) => due(t) !== null && isBefore(due(t)!, end))
      : view.kind === 'upcoming'
        ? open.filter((t) => due(t) !== null && !isBefore(due(t)!, end))
        : view.kind === 'list'
          ? open.filter((t) => t.list === view.name)
          : open
  return picked.sort(view.kind === 'upcoming' ? (a, b) => due(a)!.getTime() - due(b)!.getTime() || byImportance(a, b) : byImportance)
}

export function doneTasks(tasks: Task[], view: TaskView): Task[] {
  const done = tasks.filter((t) => t.done)
  const picked =
    view.kind === 'today'
      ? done.filter((t) => t.done_at && isToday(new Date(t.done_at)))
      : view.kind === 'upcoming'
        ? []
        : view.kind === 'list'
          ? done.filter((t) => t.list === view.name)
          : done
  return picked.sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))
}

export function countFor(tasks: Task[], view: TaskView) {
  return openTasks(tasks, view).length
}

export function listNames(tasks: Task[], extra: string[] = []) {
  const names = new Set([DEFAULT_LIST, ...extra, ...tasks.map((t) => t.list)])
  return [DEFAULT_LIST, ...[...names].filter((n) => n !== DEFAULT_LIST).sort((a, b) => a.localeCompare(b))]
}

export function dueLabel(iso: string) {
  const d = new Date(iso)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isSameDay(d, addDays(today(), -1))) return 'Yesterday'
  return format(d, d.getFullYear() === new Date().getFullYear() ? 'EEE d MMM' : 'd MMM yyyy')
}

const weekdays: Record<string, Day> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

// Quick add understands a few words anywhere in the text:
// "today", "tomorrow", a weekday ("fri"), "!" to "!!!" for priority, "#list".
export function parseQuickAdd(text: string, defaults: Pick<TaskInput, 'list' | 'due_at'>): TaskInput {
  let list = defaults.list
  let dueAt = defaults.due_at
  let priority: Priority = 0
  const words: string[] = []
  for (const word of text.trim().split(/\s+/)) {
    const w = word.toLowerCase()
    if (/^!{1,3}$/.test(w)) priority = w.length as Priority
    else if (w === 'today') dueAt = today().toISOString()
    else if (w === 'tomorrow' || w === 'tmr') dueAt = addDays(today(), 1).toISOString()
    else if (/^(mon(day)?|tues?(day)?|wed(nesday)?|thu(rs?)?(day)?|fri(day)?|sat(urday)?|sun(day)?)$/.test(w))
      dueAt = nextDay(today(), weekdays[w.slice(0, 3)]).toISOString()
    else if (/^#\S+/.test(word)) list = word.slice(1)
    else words.push(word)
  }
  return { title: words.join(' '), notes: '', list, due_at: dueAt, priority }
}
