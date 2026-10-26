import { format, isToday } from 'date-fns'
import { occurrencesOnDay } from './occurrences'
import { occurrenceTimeLabel } from './format'
import type { Occurrence } from './types'

interface Props {
  day: Date
  occurrences: Occurrence[]
  onAdd: () => void
  onOpen: (o: Occurrence) => void
}

export default function DayAgenda({ day, occurrences, onAdd, onOpen }: Props) {
  const items = occurrencesOnDay(occurrences, day)

  return (
    <aside className="agenda">
      <div className="agenda-head">
        <div>
          <div className="agenda-weekday">{isToday(day) ? 'Today' : format(day, 'EEEE')}</div>
          <div className="agenda-date">{format(day, 'd MMMM yyyy')}</div>
        </div>
        <button className="icon-btn primary" onClick={onAdd} aria-label="Add event on this day">
          +
        </button>
      </div>
      {items.length === 0 ? (
        <div className="agenda-empty">
          <p>Nothing planned.</p>
          <button className="link-btn" onClick={onAdd}>
            Add something
          </button>
        </div>
      ) : (
        <ul className="agenda-list">
          {items.map((o) => (
            <li key={o.key}>
              <button className={`agenda-item c-${o.event.color ?? 'violet'}`} onClick={() => onOpen(o)}>
                <span className="agenda-bar" />
                <span className="agenda-body">
                  <span className="agenda-title">{o.event.title}</span>
                  <span className="agenda-meta">
                    {occurrenceTimeLabel(o, day)}
                    {o.event.location && ` · ${o.event.location}`}
                    {o.event.recurrence && ' · ↻'}
                  </span>
                  {o.event.description && <span className="agenda-desc">{o.event.description}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
