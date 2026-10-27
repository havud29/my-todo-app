import { useEffect, useRef, useState } from 'react'
import { addDays, differenceInMinutes, format, isToday, max, min, startOfDay } from 'date-fns'
import { occurrencesOnDay } from './occurrences'
import { weekRange } from './ranges'
import { occurrenceTimeLabel } from './format'
import type { Occurrence } from './types'

interface Props {
  week: Date
  occurrences: Occurrence[]
  onAddAt: (start: Date) => void
  onOpen: (o: Occurrence) => void
}

const hourHeight = 48
const hours = Array.from({ length: 24 }, (_, h) => h)

interface Placed {
  o: Occurrence
  top: number
  height: number
  col: number
  cols: number
}

// Lays out the timed occurrences of one day side by side where they overlap
function layoutDay(items: Occurrence[], day: Date): Placed[] {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  const segs = items
    .map((o) => {
      const s = max([o.start, dayStart])
      const e = min([o.end, dayEnd])
      return { o, s, e }
    })
    .sort((a, b) => a.s.getTime() - b.s.getTime() || b.e.getTime() - a.e.getTime())

  const placed: Placed[] = []
  let cluster: Placed[] = []
  let clusterEnd = 0
  const columnEnds: number[] = []

  const flush = () => {
    const cols = columnEnds.length
    cluster.forEach((p) => (p.cols = cols))
    cluster = []
    columnEnds.length = 0
  }

  for (const { o, s, e } of segs) {
    if (cluster.length && s.getTime() >= clusterEnd) flush()
    let col = columnEnds.findIndex((end) => end <= s.getTime())
    if (col === -1) col = columnEnds.length
    columnEnds[col] = e.getTime()
    clusterEnd = Math.max(clusterEnd, e.getTime())
    const top = (differenceInMinutes(s, dayStart) / 60) * hourHeight
    const height = Math.max((differenceInMinutes(e, s) / 60) * hourHeight, 22)
    const p = { o, top, height, col, cols: 1 }
    cluster.push(p)
    placed.push(p)
  }
  flush()
  return placed
}

export default function WeekView({ week, occurrences, onAddAt, onOpen }: Props) {
  const { start } = weekRange(week)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const scroller = useRef<HTMLDivElement>(null)

  // Open the day at 7:00 rather than midnight
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7 * hourHeight
  }, [])

  const isAllDayOn = (o: Occurrence, day: Date) =>
    o.event.all_day || (o.start < startOfDay(day) && o.end >= addDays(startOfDay(day), 1))

  return (
    <div className="week">
      <div className="week-head">
        <div className="gutter" />
        {days.map((d) => (
          <div key={d.toISOString()} className={isToday(d) ? 'week-day today' : 'week-day'}>
            <span className="wd">{format(d, 'EEE')}</span>
            <span className="dn">{format(d, 'd')}</span>
          </div>
        ))}
      </div>
      <div className="week-allday">
        <div className="gutter">all-day</div>
        {days.map((d) => (
          <div key={d.toISOString()} className="allday-cell">
            {occurrencesOnDay(occurrences, d)
              .filter((o) => isAllDayOn(o, d))
              .map((o) => (
                <button key={o.key} className={`chip solid c-${o.event.color ?? 'violet'}`} onClick={() => onOpen(o)}>
                  <span className="chip-title">{o.event.title}</span>
                </button>
              ))}
          </div>
        ))}
      </div>
      <div className="week-body" ref={scroller}>
        <div className="week-times" style={{ height: 24 * hourHeight }}>
          {hours.map((h) => (
            <div key={h} className="hour-label" style={{ top: h * hourHeight }}>
              {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
            </div>
          ))}
        </div>
        {days.map((d) => {
          const timed = occurrencesOnDay(occurrences, d).filter((o) => !isAllDayOn(o, d))
          return (
            <div
              key={d.toISOString()}
              className="week-col"
              style={{ height: 24 * hourHeight }}
              onClick={(e) => {
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                const half = Math.floor(y / (hourHeight / 2))
                const at = new Date(startOfDay(d).getTime() + half * 30 * 60 * 1000)
                onAddAt(at)
              }}
            >
              {hours.map((h) => (
                <div key={h} className="hour-line" style={{ top: h * hourHeight }} />
              ))}
              {isToday(d) && <NowLine />}
              {layoutDay(timed, d).map(({ o, top, height, col, cols }) => (
                <button
                  key={o.key}
                  className={`block c-${o.event.color ?? 'violet'}`}
                  style={{
                    top,
                    height,
                    left: `calc(${(col / cols) * 100}% + 2px)`,
                    width: `calc(${100 / cols}% - 4px)`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpen(o)
                  }}
                >
                  <span className="block-title">{o.event.title}</span>
                  {height > 34 && <span className="block-time">{occurrenceTimeLabel(o, d)}</span>}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NowLine() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const top = (differenceInMinutes(now, startOfDay(now)) / 60) * hourHeight
  return <div className="now-line" style={{ top }} />
}
