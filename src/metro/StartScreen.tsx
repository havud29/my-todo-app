import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { format, isSameDay, isToday } from 'date-fns'
import { useTimeline } from '../features/timeline/useTimeline'
import { useNotes } from '../features/notes/useNotes'
import { useMilestones } from '../features/milestones/useMilestones'
import { byTarget, countdown, progressOf } from '../features/milestones/progress'
import { useBudget } from '../features/budget/useBudget'
import { formatMoney, monthKey, totals, useCurrency } from '../features/budget/money'
import { setMetro, useMetro, type TileSize } from '../lib/metro'
import { signOut } from '../lib/supabase'
import Glyph from './icons'
import { openAssistant } from './assistant'

interface TileDef {
  id: string
  label: string
  glyph: string
  href?: string
  action?: () => void
  sizes: TileSize[] // the first is the default
  count?: number
  // Live content, shown in turn after the icon on medium and wide tiles
  faces?: (size: TileSize) => ReactNode[]
  motion?: 'flip' | 'peek'
}

const sizeOrder: TileSize[] = ['medium', 'small', 'wide']
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The Start screen: one live tile per page, plus a few small ones. Hold a
// tile (or right-click it) to resize it, like on the phone.
export default function StartScreen() {
  const tiles = useLiveTiles()
  const { sizes } = useMetro()
  const [editing, setEditing] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const grid = useRef<HTMLDivElement>(null)

  // Tiles swing around the left edge of the screen, so each needs its offset
  useLayoutEffect(() => {
    const place = () =>
      grid.current?.querySelectorAll<HTMLElement>('.tile-slot').forEach((s) => s.style.setProperty('--x', `${s.offsetLeft}px`))
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  })

  useEffect(() => {
    if (!editing) return
    const done = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(null)
    window.addEventListener('keydown', done)
    return () => window.removeEventListener('keydown', done)
  }, [editing])

  // Turnstile out: tiles fall away top to bottom, the tapped one last
  function launch(tile: TileDef, slot: HTMLElement) {
    if (tile.action) return tile.action()
    if (!tile.href || leaving) return
    if (reduced()) {
      window.location.hash = tile.href
      return
    }
    let last = 0
    for (const s of grid.current!.querySelectorAll<HTMLElement>('.tile-slot')) {
      if (s === slot) continue
      const delay = Math.round(s.offsetTop / 6 + Math.random() * 40)
      s.style.animationDelay = `${delay}ms`
      last = Math.max(last, delay)
    }
    slot.style.animationDelay = `${last + 70}ms`
    setLeaving(true)
    setTimeout(() => (window.location.hash = tile.href!), last + 70 + 240)
  }

  function resize(tile: TileDef) {
    const options = sizeOrder.filter((s) => tile.sizes.includes(s))
    const next = options[(options.indexOf(sizeOf(tile)) + 1) % options.length]
    setMetro({ sizes: { ...sizes, [tile.id]: next } })
  }

  const sizeOf = (t: TileDef) => (t.sizes.includes(sizes[t.id]) ? sizes[t.id] : t.sizes[0])

  return (
    <div
      className={`wp-start ${editing ? 'editing' : ''} ${leaving ? 'leaving' : ''}`}
      onClick={(e) => editing && !(e.target as Element).closest('.tile-slot') && setEditing(null)}
    >
      <div ref={grid} className="tile-grid">
        {tiles.map((t, i) => (
          <Tile
            key={t.id}
            tile={t}
            index={i}
            size={sizeOf(t)}
            editing={editing !== null}
            selected={editing === t.id}
            onHold={() => setEditing(t.id)}
            onLaunch={(slot) => (editing ? setEditing(t.id) : launch(t, slot))}
            onResize={() => resize(t)}
          />
        ))}
      </div>
      {editing && (
        <button className="wp-done" onClick={() => setEditing(null)}>
          done
        </button>
      )}
    </div>
  )
}

function Tile(props: {
  tile: TileDef
  index: number
  size: TileSize
  editing: boolean
  selected: boolean
  onHold: () => void
  onLaunch: (slot: HTMLElement) => void
  onResize: () => void
}) {
  const { tile, index, size, editing, selected, onHold, onLaunch, onResize } = props
  const slot = useRef<HTMLDivElement>(null)
  const hold = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null)
  const [turn, setTurn] = useState(0)
  const [moving, setMoving] = useState(false)

  const faces = [<Iconic key="icon" tile={tile} size={size} />, ...(size === 'small' ? [] : (tile.faces?.(size) ?? []))]
  const live = faces.length > 1 && !editing

  // Each live tile turns over on its own rhythm, so they don't all move at once
  useEffect(() => {
    if (!live || reduced()) return
    const id = window.setTimeout(() => setMoving(true), 3500 + ((index * 1700) % 5000) + Math.random() * 3000)
    return () => clearTimeout(id)
  }, [live, turn, index])

  const press = (e: PointerEvent) => {
    if (e.button !== 0) return
    const timer = window.setTimeout(() => {
      if (hold.current) hold.current.fired = true
      onHold()
    }, 550)
    hold.current = { timer, x: e.clientX, y: e.clientY, fired: false }
  }
  const cancel = () => hold.current && clearTimeout(hold.current.timer)

  return (
    <div ref={slot} className={`tile-slot ${size} ${selected ? 'selected' : ''}`} style={{ '--i': index } as CSSProperties}>
      <a
        href={tile.href ?? '#'}
        className={`tile ${tile.motion ?? 'flip'} ${moving && live ? 'moving' : ''}`}
        aria-label={tile.count ? `${tile.label}, ${tile.count}` : tile.label}
        draggable={false}
        onPointerDown={press}
        onPointerMove={(e) => {
          const h = hold.current
          if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 10) cancel()
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onContextMenu={(e) => {
          e.preventDefault()
          onHold()
        }}
        onClick={(e) => {
          e.preventDefault()
          if (hold.current?.fired) {
            hold.current = null
            return
          }
          onLaunch(slot.current!)
        }}
      >
        <div
          className="tile-faces"
          onAnimationEnd={(e) => {
            if (e.target !== e.currentTarget) return
            setMoving(false)
            setTurn((t) => t + 1)
          }}
        >
          <div className="tile-face front">{faces[turn % faces.length]}</div>
          {live && <div className="tile-face back">{faces[(turn + 1) % faces.length]}</div>}
        </div>
      </a>
      {selected && (
        <button className="tile-resize" aria-label={`Resize ${tile.label}`} onClick={onResize}>
          <Glyph name="resize" size={16} />
        </button>
      )}
    </div>
  )
}

// The tile's resting face: its glyph, a count beside it, and its name
function Iconic({ tile, size }: { tile: TileDef; size: TileSize }) {
  const count = tile.count ? (tile.count > 99 ? '99+' : String(tile.count)) : null
  return (
    <div className={`iconic ${size}`}>
      <span className="iconic-mark">
        <Glyph name={tile.glyph} size={size === 'small' ? 30 : 46} />
        {count && <span className="iconic-count">{count}</span>}
      </span>
      {size !== 'small' && <span className="tile-label">{tile.label}</span>}
    </div>
  )
}

function Lines({ label, children, corner }: { label: string; children: ReactNode; corner?: ReactNode }) {
  return (
    <div className="tile-text">
      <div className="tile-lines">{children}</div>
      {corner}
      <span className="tile-label">{label}</span>
    </div>
  )
}

// Live data for the tiles, from the same hooks the pages use
function useLiveTiles(): TileDef[] {
  const { items } = useTimeline(2)
  const { notes } = useNotes()
  const { milestones, steps } = useMilestones()
  const { txns } = useBudget()
  const currency = useCurrency()
  const { background } = useMetro()
  const now = new Date()

  const events = items.filter((i) => i.kind === 'event')
  const todayEvents = events.filter((i) => isSameDay(i.date, now))
  const due = items.filter((i) => i.kind === 'task' && (i.overdue || isToday(i.date)))
  const upcoming = items.filter((i) => !i.overdue).slice(0, 3)
  const latest = notes.filter((n) => n.title || n.body).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  const goal = milestones.filter((m) => !m.achieved_at).sort(byTarget)[0]
  const goalSteps = goal ? progressOf(steps.filter((s) => s.milestone_id === goal.id)) : null
  const month = totals(txns, monthKey(now))
  const money = (n: number) => formatMoney(n, currency)
  const today = (
    <span className="tile-corner">
      <b>{format(now, 'd')}</b>
      <span>{format(now, 'EEEE').toLowerCase()}</span>
    </span>
  )

  return [
    {
      id: 'calendar',
      label: 'Calendar',
      glyph: 'calendar',
      href: '#/calendar',
      sizes: ['wide', 'medium', 'small'],
      count: todayEvents.length,
      faces: (size) => [
        ...events.slice(0, size === 'wide' ? 2 : 1).map((e) => (
          <Lines key={e.key} label="Calendar" corner={today}>
            <strong>{e.title}</strong>
            <span>{e.detail}</span>
            {!isToday(e.date) && <span>{format(e.date, 'EEEE d MMMM').toLowerCase()}</span>}
          </Lines>
        )),
        ...(events.length ? [] : [<Lines key="day" label="Calendar" corner={today}>
            {null}
          </Lines>]),
      ],
    },
    {
      id: 'tasks',
      label: 'Tasks',
      glyph: 'tasks',
      href: '#/tasks',
      sizes: ['medium', 'small', 'wide'],
      count: due.length,
      faces: () =>
        due.length
          ? [
              <Lines key="due" label="Tasks">
                {due.slice(0, 3).map((t) => (
                  <span key={t.key} className={t.overdue ? 'late' : undefined}>
                    {t.title}
                  </span>
                ))}
              </Lines>,
            ]
          : [],
    },
    {
      id: 'notes',
      label: 'Notes',
      glyph: 'notes',
      href: '#/notes',
      sizes: ['medium', 'small', 'wide'],
      motion: 'peek',
      faces: () =>
        latest.slice(0, 2).map((n) => (
          <Lines key={n.id} label="Notes">
            <strong>{n.title || 'Untitled'}</strong>
            <span className="tile-body">{n.body}</span>
          </Lines>
        )),
    },
    {
      id: 'milestones',
      label: 'Milestones',
      glyph: 'milestones',
      href: '#/milestones',
      sizes: ['medium', 'small', 'wide'],
      faces: () =>
        goal && goalSteps
          ? [
              <Lines key="goal" label="Milestones" corner={<span className="tile-corner"><b>{goalSteps.pct}%</b></span>}>
                <strong>
                  {goal.emoji} {goal.title}
                </strong>
                <span>
                  {goalSteps.done} of {goalSteps.total} steps
                </span>
                {countdown(goal) && <span>{countdown(goal)!.label}</span>}
              </Lines>,
            ]
          : [],
    },
    {
      id: 'budget',
      label: 'Budget',
      glyph: 'budget',
      href: '#/budget',
      sizes: ['medium', 'small', 'wide'],
      motion: 'peek',
      faces: () =>
        txns.length
          ? [
              <Lines key="month" label="Budget">
                <span>spent in {format(now, 'MMMM').toLowerCase()}</span>
                <strong className="tile-big">{money(month.spent)}</strong>
                <span>net {money(month.net)}</span>
              </Lines>,
            ]
          : [],
    },
    {
      id: 'timeline',
      label: 'Timeline',
      glyph: 'timeline',
      href: '#/timeline',
      sizes: ['wide', 'medium', 'small'],
      faces: () =>
        upcoming.length
          ? [
              <Lines key="next" label="Timeline">
                {upcoming.map((u) => (
                  <span key={u.key}>
                    <b>{isToday(u.date) ? 'today' : format(u.date, 'EEE d').toLowerCase()}</b> {u.title}
                  </span>
                ))}
              </Lines>,
            ]
          : [],
    },
    { id: 'claude', label: 'Claude', glyph: 'claude', action: openAssistant, sizes: ['small', 'medium'] },
    { id: 'settings', label: 'Settings', glyph: 'settings', href: '#/settings', sizes: ['small', 'medium'] },
    {
      id: 'background',
      label: background === 'dark' ? 'Light' : 'Dark',
      glyph: 'theme',
      action: () => setMetro({ background: background === 'dark' ? 'light' : 'dark' }),
      sizes: ['small', 'medium'],
    },
    { id: 'signout', label: 'Sign out', glyph: 'power', action: () => void signOut(), sizes: ['small', 'medium'] },
  ]
}
