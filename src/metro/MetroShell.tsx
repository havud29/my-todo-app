import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import type { Session } from '@supabase/supabase-js'
import { pages, type Route } from '../lib/nav'
import { signOut } from '../lib/supabase'
import { useTilt } from './useTilt'
import Glyph from './icons'
import StartScreen from './StartScreen'
import MetroSettings from './MetroSettings'
import { openAssistant } from './assistant'
import './metro.css'

type View = 'start' | 'settings' | 'page'

// The Start screen is the home of this theme, so a bare address opens it
function readView(): View {
  const h = window.location.hash.replace(/^#\/?/, '')
  if (h === '' || h === 'start') return 'start'
  if (h === 'settings') return 'settings'
  return 'page'
}

// Windows Phone 8 style shell: a Start screen of live tiles, pages with
// pivot headers, and an app bar along the bottom.
export default function MetroShell({ session, route, children }: { session: Session; route: Route; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const view = useView()
  const now = useClock()
  useTilt(root)

  // Pages slide in pivot-style from the side they sit on; coming from Start
  // or Settings they swing in like a turnstile.
  const last = useRef<{ view: View; route: Route } | null>(null)
  const motion = useMemo(() => {
    const prev = last.current
    if (prev?.view !== 'page' || view !== 'page' || prev.route === route) return 'turnstile'
    const from = pages.findIndex((p) => p.route === prev.route)
    const to = pages.findIndex((p) => p.route === route)
    return (to - from + pages.length) % pages.length <= pages.length / 2 ? 'slide-next' : 'slide-prev'
  }, [view, route])
  useEffect(() => {
    last.current = { view, route }
  }, [view, route])

  return (
    <div ref={root} className="metro">
      <div className="wp-status" aria-hidden>
        <span>{format(now, 'HH:mm')}</span>
      </div>

      {view === 'start' && <StartScreen />}

      {view === 'settings' && (
        <div className="wp-page">
          <header className="wp-head">
            <div className="wp-apptitle">SETTINGS</div>
            <h1 className="wp-pagetitle motion-turnstile">theme</h1>
          </header>
          <main className="wp-content motion-turnstile">
            <MetroSettings session={session} />
          </main>
        </div>
      )}

      {view === 'page' && (
        <div className="wp-page">
          <header className="wp-head">
            <div className="wp-apptitle">MY TO-DO</div>
            <Pivot route={route} motion={motion} />
          </header>
          <main key={route} className={`wp-content motion-${motion}`}>
            {children}
          </main>
        </div>
      )}

      {view !== 'start' && <AppBar />}
    </div>
  )
}

// Pivot headers: the current page first in white, the rest trailing off in
// grey. Tap one, or swipe the headers sideways, to move between pages.
function Pivot({ route, motion }: { route: Route; motion: string }) {
  const i = pages.findIndex((p) => p.route === route)
  const order = [...pages.slice(i), ...pages.slice(0, i)]
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const go = (step: number) => {
    window.location.hash = `#/${pages[(i + step + pages.length) % pages.length].route}`
  }

  return (
    <nav
      className="pivot"
      aria-label="Pages"
      onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        if (!swipe.current) return
        const dx = e.clientX - swipe.current.x
        const dy = e.clientY - swipe.current.y
        swipe.current = null
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
    >
      <div key={route} className={`pivot-row motion-${motion}`}>
        {order.map((p) => (
          <a
            key={p.route}
            href={`#/${p.route}`}
            className="pivot-item"
            aria-current={p.route === route ? 'page' : undefined}
            draggable={false}
          >
            {p.label.toLowerCase()}
          </a>
        ))}
      </div>
    </nav>
  )
}

// The application bar: round icon buttons, and "..." to show their labels
// and the menu.
function AppBar() {
  const [open, setOpen] = useState(false)
  const bar = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !bar.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [open])

  const done = () => setOpen(false)

  return (
    <nav ref={bar} className={open ? 'appbar open' : 'appbar'} aria-label="App bar">
      <div className="appbar-buttons">
        <a className="appbar-btn" href="#/start" onClick={done}>
          <span className="appbar-ring">
            <Glyph name="start" size={20} />
          </span>
          <span className="appbar-label">start</span>
        </a>
        <button
          className="appbar-btn"
          onClick={() => {
            done()
            openAssistant()
          }}
        >
          <span className="appbar-ring">
            <Glyph name="claude" size={20} />
          </span>
          <span className="appbar-label">claude</span>
        </button>
        <a className="appbar-btn" href="#/settings" onClick={done}>
          <span className="appbar-ring">
            <Glyph name="settings" size={20} />
          </span>
          <span className="appbar-label">settings</span>
        </a>
      </div>
      <button className="appbar-more" aria-label={open ? 'Less' : 'More'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden>•••</span>
      </button>
      {open && (
        <ul className="appbar-menu" role="menu">
          <li>
            <a role="menuitem" href="#/settings" onClick={done}>
              theme settings
            </a>
          </li>
          <li>
            <button role="menuitem" onClick={signOut}>
              sign out
            </button>
          </li>
        </ul>
      )}
    </nav>
  )
}

function useView() {
  const [view, setView] = useState(readView)
  useEffect(() => {
    const onChange = () => setView(readView())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return view
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])
  return now
}
