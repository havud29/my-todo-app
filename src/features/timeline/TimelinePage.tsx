import { useState } from 'react'
import { format, isSameDay, isToday, isTomorrow, startOfDay } from 'date-fns'
import Window from '../../components/Window'
import { useTimeline, type ItemKind, type TimelineItem } from './useTimeline'
import './timeline.css'

const kinds: { kind: ItemKind; label: string; route: string; icon: string }[] = [
  { kind: 'event', label: 'Events', route: 'calendar', icon: '◷' },
  { kind: 'task', label: 'Tasks', route: 'tasks', icon: '✓' },
  { kind: 'milestone', label: 'Milestones', route: 'milestones', icon: '⚑' },
]

const dayLabel = (d: Date) => (isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEEE'))

interface Day {
  date: Date
  items: TimelineItem[]
}

// Groups sorted items into months, then days
function group(items: TimelineItem[]) {
  const months: { label: string; days: Day[] }[] = []
  for (const item of items) {
    const label = format(item.date, 'MMMM yyyy')
    let month = months.at(-1)
    if (month?.label !== label) months.push((month = { label, days: [] }))
    let day = month.days.at(-1)
    if (!day || !isSameDay(day.date, item.date)) month.days.push((day = { date: startOfDay(item.date), items: [] }))
    day.items.push(item)
  }
  return months
}

export default function TimelinePage() {
  const [months, setMonths] = useState(3)
  const [hidden, setHidden] = useState<ItemKind[]>([])
  const { items, loading, error, reload, completeTask } = useTimeline(months)

  const shown = items.filter((i) => !hidden.includes(i.kind))
  const overdue = shown.filter((i) => i.overdue)
  const upcoming = group(shown.filter((i) => !i.overdue))

  const toggleKind = (k: ItemKind) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))

  const row = (item: TimelineItem) => {
    const meta = kinds.find((k) => k.kind === item.kind)!
    return (
      <li key={item.key} className={`tl-item tl-${item.kind} c-${item.color} ${item.overdue ? 'overdue' : ''}`}>
        {item.task ? (
          <button
            className="tl-check"
            role="checkbox"
            aria-checked={false}
            aria-label={`Complete "${item.title}"`}
            onClick={() => completeTask(item.task!)}
          />
        ) : (
          <span className="tl-dot" aria-hidden>
            {meta.icon}
          </span>
        )}
        <a className="tl-body" href={`#/${meta.route}`}>
          <span className="tl-title">{item.title}</span>
          <span className="tl-detail">
            <span className="tl-kind">{item.kind}</span>
            {item.overdue && <span className="tl-late">{format(item.date, 'd MMM')}</span>}
            {item.detail && <span>{item.detail}</span>}
          </span>
        </a>
      </li>
    )
  }

  return (
    <Window title="Timeline - My To-do" icon="timeline" className="timeline-window">
      <div className="timeline">
        <header className="tl-head">
          <h1 className="cal-title">Timeline</h1>
          <div className="tl-filters" role="group" aria-label="Show">
            {kinds.map((k) => (
              <button key={k.kind} className={`tl-filter tl-${k.kind}`} aria-pressed={!hidden.includes(k.kind)} onClick={() => toggleKind(k.kind)}>
                {k.icon} {k.label}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="banner">
            Couldn't load your timeline: {error} <button onClick={reload}>Retry</button>
          </div>
        )}

        <div className="tl-panel">
          {overdue.length > 0 && (
            <section className="tl-month tl-overdue">
              <h2 className="tl-month-head">Overdue</h2>
              <ul className="tl-items">{overdue.map(row)}</ul>
            </section>
          )}

          {upcoming.map((m) => (
            <section key={m.label} className="tl-month">
              <h2 className="tl-month-head">{m.label}</h2>
              {m.days.map((d) => (
                <div key={d.date.toISOString()} className={`tl-day ${isToday(d.date) ? 'today' : ''}`}>
                  <div className="tl-date">
                    <span className="tl-dnum">{format(d.date, 'd')}</span>
                    <span className="tl-dname">{dayLabel(d.date)}</span>
                  </div>
                  <ul className="tl-items">{d.items.map(row)}</ul>
                </div>
              ))}
            </section>
          ))}

          {!loading && shown.length === 0 && <p className="tl-empty">Nothing coming up in the next {months} months.</p>}

          <button className="tl-more" onClick={() => setMonths((n) => n + 3)}>
            Show 3 more months
          </button>
        </div>
      </div>
    </Window>
  )
}
