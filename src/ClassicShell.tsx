import { useEffect, useRef, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import type { Session } from '@supabase/supabase-js'
import { signOut } from './lib/supabase'
import { setTheme, themes, useTheme } from './lib/theme'
import { pages as programs, type Route } from './lib/nav'

const icon = (name: string) => `${import.meta.env.BASE_URL}aero/${name}.svg`


// Windows 7 style desktop: wallpaper, the page in front, and a taskbar with a
// Start orb, pinned programs and a clock.
export default function ClassicShell({ session, route, children }: { session: Session; route: Route; children: ReactNode }) {
  const [startOpen, setStartOpen] = useState(false)
  const theme = useTheme()
  const now = useClock()
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!startOpen) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menu.current?.contains(e.target as Node)) setStartOpen(false)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
    }
  }, [startOpen])

  const name = session.user.user_metadata?.full_name ?? session.user.email ?? 'You'

  return (
    <div className="desktop">
      <main className="desktop-area">{children}</main>

      <nav className="taskbar" aria-label="Taskbar">
        <div ref={menu} className="start-wrap">
          <button
            className={startOpen ? 'start-orb open' : 'start-orb'}
            aria-label="Start"
            aria-expanded={startOpen}
            onClick={() => setStartOpen((o) => !o)}
          >
            <img src={icon('orb')} alt="" />
          </button>

          {startOpen && (
            <div className="start-menu" role="menu">
              <div className="start-left">
                {programs.map((p) => (
                  <a key={p.route} href={`#/${p.route}`} role="menuitem" className="start-item" onClick={() => setStartOpen(false)}>
                    <img src={icon(p.route)} alt="" />
                    <span>
                      <strong>{p.label}</strong>
                      <small>{p.hint}</small>
                    </span>
                  </a>
                ))}
              </div>
              <div className="start-right">
                <div className="user-tile" aria-hidden>
                  <span>{name.slice(0, 1).toUpperCase()}</span>
                </div>
                <div className="start-user">{name}</div>
                <div className="start-section">Theme</div>
                {themes.map((t) => (
                  <button
                    key={t.id}
                    role="menuitemradio"
                    aria-checked={theme === t.id}
                    className="start-link"
                    onClick={() => setTheme(t.id)}
                  >
                    {theme === t.id ? '● ' : ''}
                    {t.label}
                  </button>
                ))}
                <button className="shutdown" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="task-buttons">
          {programs.map((p) => (
            <a
              key={p.route}
              href={`#/${p.route}`}
              className="task-btn"
              aria-current={route === p.route ? 'page' : undefined}
              title={p.label}
            >
              <img src={icon(p.route)} alt="" />
              <span className="task-label">{p.label}</span>
            </a>
          ))}
        </div>

        <div className="tray">
          <span className="tray-time">{format(now, 'HH:mm')}</span>
          <span className="tray-date">{format(now, 'dd/MM/yyyy')}</span>
        </div>
        <span className="show-desktop" aria-hidden />
      </nav>
    </div>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])
  return now
}
