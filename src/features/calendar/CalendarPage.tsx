import { useState } from 'react'
import { addMonths, addWeeks, format, isSameMonth, setHours, startOfDay, startOfHour } from 'date-fns'
import MonthView from './MonthView'
import WeekView from './WeekView'
import { monthGridRange, weekRange } from './ranges'
import DayAgenda from './DayAgenda'
import EventDialog from './EventDialog'
import { useEvents } from './useEvents'
import { createEvent, deleteEvent, updateEvent } from './api'
import type { CalendarEvent, EventInput, Occurrence } from './types'
import Window from '../../components/Window'
import { useTheme } from '../../lib/theme'
import './calendar.css'

type View = 'month' | 'week'
type DialogTarget = { event: CalendarEvent } | { start: Date; allDay?: boolean } | null

export default function CalendarPage() {
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  const [dialog, setDialog] = useState<DialogTarget>(null)
  // Classic shows the day agenda as a desktop gadget beside the window
  const gadget = useTheme() === 'aero-classic'

  const range = view === 'month' ? monthGridRange(cursor) : weekRange(cursor)
  const { occurrences, loading, error, reload } = useEvents(range.start, range.end)

  const step = (dir: 1 | -1) => {
    const next = view === 'month' ? addMonths(cursor, dir) : addWeeks(cursor, dir)
    setCursor(next)
    if (view === 'month' && !isSameMonth(selected, next)) setSelected(next)
  }
  const goToday = () => {
    const today = startOfDay(new Date())
    setCursor(today)
    setSelected(today)
  }

  // New events on a picked day start at the next hour if it's today, else at 9:00
  const defaultStartOn = (day: Date) => {
    const now = new Date()
    if (startOfDay(now).getTime() === day.getTime() && now.getHours() < 23) {
      return startOfHour(new Date(now.getTime() + 60 * 60 * 1000))
    }
    return setHours(day, 9)
  }

  const openNew = (start: Date, allDay = false) => setDialog({ start, allDay })
  const openExisting = (o: Occurrence) => setDialog({ event: o.event })

  const save = async (input: EventInput) => {
    if (dialog && 'event' in dialog) await updateEvent(dialog.event.id, input)
    else await createEvent(input)
    await reload()
  }
  const remove =
    dialog && 'event' in dialog
      ? async () => {
          await deleteEvent(dialog.event.id)
          await reload()
        }
      : undefined

  const title =
    view === 'month'
      ? format(cursor, 'MMMM yyyy')
      : `${format(range.start, 'd MMM')} – ${format(new Date(range.end.getTime() - 1), 'd MMM yyyy')}`

  const agenda = (
    <DayAgenda
      day={selected}
      occurrences={occurrences}
      onAdd={() => openNew(defaultStartOn(selected))}
      onOpen={openExisting}
    />
  )

  return (
    <div className="cal-desktop">
      <Window title="Calendar - My To-do" icon="calendar" className="cal-window">
        <div className="calendar">
          <div className="cal-toolbar">
            <h1 className="cal-title">{title}</h1>
            <div className="cal-controls">
              <div className="segmented" role="tablist">
                {(['month', 'week'] as View[]).map((v) => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
                    {v === 'month' ? 'Month' : 'Week'}
                  </button>
                ))}
              </div>
              <div className="nav-group">
                <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous">
                  ‹
                </button>
                <button onClick={goToday}>Today</button>
                <button className="icon-btn" onClick={() => step(1)} aria-label="Next">
                  ›
                </button>
              </div>
              <button className="primary new-btn" onClick={() => openNew(defaultStartOn(selected))}>
                + New event
              </button>
            </div>
          </div>

          {error && (
            <div className="banner">
              Couldn't load your calendar: {error} <button onClick={reload}>Retry</button>
            </div>
          )}

          <div className={`cal-body view-${view} ${loading ? 'loading' : ''}`}>
            {view === 'month' ? (
              <>
                <MonthView
                  month={cursor}
                  selected={selected}
                  occurrences={occurrences}
                  onSelectDay={setSelected}
                  onAddOnDay={(d) => openNew(defaultStartOn(d))}
                  onOpen={openExisting}
                />
                {!gadget && agenda}
              </>
            ) : (
              <WeekView week={cursor} occurrences={occurrences} onAddAt={(d) => openNew(d)} onOpen={openExisting} />
            )}
          </div>

          {dialog && (
            <EventDialog
              key={'event' in dialog ? dialog.event.id : dialog.start.toISOString()}
              target={dialog}
              onSave={save}
              onDelete={remove}
              onClose={() => setDialog(null)}
            />
          )}
        </div>
      </Window>
      {gadget && view === 'month' && agenda}
      <button className="fab primary" onClick={() => openNew(defaultStartOn(selected))} aria-label="New event">
        +
      </button>
    </div>
  )
}
