import { useState } from 'react'
import { addDays, format, isToday, startOfDay } from 'date-fns'
import Window from '../../components/Window'
import TaskDialog from './TaskDialog'
import { useTasks } from './useTasks'
import { countFor, DEFAULT_LIST, doneTasks, dueLabel, isOverdue, listNames, openTasks, parseQuickAdd, viewTitle } from './views'
import type { Task, TaskView } from './types'
import './tasks.css'

const smartViews: { view: TaskView; icon: string }[] = [
  { view: { kind: 'today' }, icon: '☀' },
  { view: { kind: 'upcoming' }, icon: '🗓' },
  { view: { kind: 'all' }, icon: '☰' },
]

const sameView = (a: TaskView, b: TaskView) =>
  a.kind === b.kind && (a.kind !== 'list' || (b.kind === 'list' && a.name === b.name))

export default function TasksPage() {
  const { tasks, loading, error, reload, add, patch, toggle, remove } = useTasks()
  const [view, setView] = useState<TaskView>({ kind: 'today' })
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [madeLists, setMadeLists] = useState<string[]>([])

  const lists = listNames(tasks, madeLists)
  const open = openTasks(tasks, view)
  const done = doneTasks(tasks, view)

  const quickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const input = parseQuickAdd(draft, {
      list: view.kind === 'list' ? view.name : DEFAULT_LIST,
      due_at:
        view.kind === 'today'
          ? startOfDay(new Date()).toISOString()
          : view.kind === 'upcoming'
            ? addDays(startOfDay(new Date()), 1).toISOString()
            : null,
    })
    if (!input.title) return
    setAdding(true)
    try {
      await add(input)
      setDraft('')
    } finally {
      setAdding(false)
    }
  }

  const newList = () => {
    const name = window.prompt('Name the new list')?.trim()
    if (!name) return
    setMadeLists((l) => [...l, name])
    setView({ kind: 'list', name })
  }

  // Upcoming groups tasks under a heading for each day
  const groups: [string, Task[]][] =
    view.kind === 'upcoming'
      ? Object.entries(
          open.reduce<Record<string, Task[]>>((acc, t) => {
            const key = format(new Date(t.due_at!), 'yyyy-MM-dd')
            ;(acc[key] ??= []).push(t)
            return acc
          }, {}),
        ).map(([, ts]) => [dueLabel(ts[0].due_at!), ts])
      : [['', open]]

  const row = (t: Task) => (
    <li key={t.id} className={`task ${t.done ? 'done' : ''} prio-${t.priority}`}>
      <button
        className="task-check"
        role="checkbox"
        aria-checked={t.done}
        aria-label={t.done ? `Mark "${t.title}" not done` : `Complete "${t.title}"`}
        onClick={() => toggle(t)}
      />
      <button className="task-main" onClick={() => setEditing(t)}>
        <span className="task-title">{t.title}</span>
        <span className="task-meta">
          {t.priority > 0 && <span className="task-prio">{'!'.repeat(t.priority)}</span>}
          {t.due_at && view.kind !== 'upcoming' && (
            <span className={`task-due ${isOverdue(t) ? 'overdue' : isToday(new Date(t.due_at)) ? 'today' : ''}`}>
              {dueLabel(t.due_at)}
            </span>
          )}
          {view.kind !== 'list' && t.list !== DEFAULT_LIST && <span className="task-list">#{t.list}</span>}
          {t.notes && <span className="task-has-notes" aria-label="Has notes">✎</span>}
        </span>
      </button>
    </li>
  )

  return (
    <Window title="Tasks - My To-do" icon="tasks" className="tasks-window">
      <div className="tasks">
        <nav className="task-views" aria-label="Task lists">
          {smartViews.map(({ view: v, icon }) => (
            <button key={v.kind} className="task-view" aria-current={sameView(v, view)} onClick={() => setView(v)}>
              <span className="tv-icon">{icon}</span>
              <span className="tv-name">{viewTitle(v)}</span>
              <span className="tv-count">{countFor(tasks, v) || ''}</span>
            </button>
          ))}
          <div className="task-views-head">Lists</div>
          {lists.map((name) => {
            const v: TaskView = { kind: 'list', name }
            return (
              <button key={name} className="task-view" aria-current={sameView(v, view)} onClick={() => setView(v)}>
                <span className="tv-icon">#</span>
                <span className="tv-name">{name}</span>
                <span className="tv-count">{countFor(tasks, v) || ''}</span>
              </button>
            )
          })}
          <button className="task-view new-list" onClick={newList}>
            <span className="tv-icon">+</span>
            <span className="tv-name">New list</span>
          </button>
        </nav>

        <section className="task-panel">
          <header className="task-head">
            <h1 className="cal-title">{viewTitle(view)}</h1>
            {view.kind === 'today' && <span className="task-date">{format(new Date(), 'EEEE d MMMM')}</span>}
          </header>

          <form className="quick-add" onSubmit={quickAdd}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a task… try “call mum fri !!”"
              aria-label="New task"
              disabled={adding}
            />
            <button className="primary" disabled={adding || !draft.trim()}>
              Add
            </button>
          </form>

          {error && (
            <div className="banner">
              Couldn't sync your tasks: {error} <button onClick={reload}>Retry</button>
            </div>
          )}

          {!loading && open.length === 0 && (
            <p className="task-empty">
              {view.kind === 'today' ? 'Nothing due today. Enjoy it.' : 'No open tasks here.'}
            </p>
          )}

          {groups.map(([label, ts]) => (
            <div key={label || 'all'} className="task-group">
              {label && <h2 className="task-group-head">{label}</h2>}
              <ul className="task-list-items">{ts.map(row)}</ul>
            </div>
          ))}

          {done.length > 0 && (
            <div className="task-group">
              <button className="link-btn done-toggle" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone}>
                {showDone ? '▾' : '▸'} Completed ({done.length})
              </button>
              {showDone && <ul className="task-list-items">{done.map(row)}</ul>}
            </div>
          )}
        </section>
      </div>

      {editing && (
        <TaskDialog
          key={editing.id}
          task={editing}
          lists={lists}
          onSave={(changes) => patch(editing.id, changes)}
          onDelete={() => remove(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </Window>
  )
}
