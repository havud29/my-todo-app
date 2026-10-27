import { addDays, eachDayOfInterval, format, isSameDay, isSameMonth, isToday } from 'date-fns'
import { occurrencesOnDay } from './occurrences'
import { monthGridRange } from './ranges'
import { timeLabel } from './format'
import type { Occurrence } from './types'

interface Props {
  month: Date
  selected: Date
  occurrences: Occurrence[]
  onSelectDay: (day: Date) => void
  onAddOnDay: (day: Date) => void
  onOpen: (o: Occurrence) => void
}

const maxChips = 3

export default function MonthView({ month, selected, occurrences, onSelectDay, onAddOnDay, onOpen }: Props) {
  const { start, end } = monthGridRange(month)
  const days = eachDayOfInterval({ start, end: addDays(end, -1) })
  const weekdays = days.slice(0, 7)

  return (
    <div className="month">
      <div className="month-weekdays">
        {weekdays.map((d) => (
          <div key={d.toISOString()}>
            <span className="long">{format(d, 'EEE')}</span>
            <span className="short">{format(d, 'EEEEE')}</span>
          </div>
        ))}
      </div>
      <div className="month-grid" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}>
        {days.map((day) => {
          const items = occurrencesOnDay(occurrences, day)
          const extra = items.length - maxChips
          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              className={[
                'month-cell',
                isSameMonth(day, month) ? '' : 'outside',
                isSameDay(day, selected) ? 'selected' : '',
              ].join(' ')}
              onClick={() => onSelectDay(day)}
              onDoubleClick={() => onAddOnDay(day)}
              onKeyDown={(e) => e.key === 'Enter' && onSelectDay(day)}
            >
              <span className={isToday(day) ? 'day-num today' : 'day-num'}>{format(day, 'd')}</span>
              <div className="chips">
                {items.slice(0, maxChips).map((o) => (
                  <button
                    key={o.key}
                    className={`chip c-${o.event.color ?? 'violet'} ${o.event.all_day ? 'solid' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen(o)
                    }}
                    title={o.event.title}
                  >
                    {!o.event.all_day && isSameDay(o.start, day) && <span className="chip-time">{timeLabel(o.start)}</span>}
                    <span className="chip-title">{o.event.title}</span>
                  </button>
                ))}
                {extra > 0 && <span className="more">+{extra} more</span>}
              </div>
              <div className="dots">
                {items.slice(0, 4).map((o) => (
                  <span key={o.key} className={`dot c-${o.event.color ?? 'violet'}`} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
