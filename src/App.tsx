import { signOut } from './lib/supabase'
import { useSession } from './lib/useSession'
import { useHashRoute, type Route } from './lib/useHashRoute'
import SignIn from './SignIn'
import ThemeSwitch from './ThemeSwitch'
import ClassicShell from './ClassicShell'
import { useTheme } from './lib/theme'
import NotesPage from './features/notes/NotesPage'
import CalendarPage from './features/calendar/CalendarPage'
import TasksPage from './features/tasks/TasksPage'
import Assistant from './features/assistant/Assistant'

const tabs: { route: Route; label: string; icon: string }[] = [
  { route: 'calendar', label: 'Calendar', icon: '◷' },
  { route: 'tasks', label: 'Tasks', icon: '✓' },
  { route: 'notes', label: 'Notes', icon: '✎' },
]

export default function App() {
  const session = useSession()
  const route = useHashRoute()
  const theme = useTheme()

  if (session === undefined) return <main className="loading-screen">Loading…</main>
  if (!session) return <SignIn />

  const page = (
    <>
      {route === 'calendar' && <CalendarPage />}
      {route === 'tasks' && <TasksPage />}
      {route === 'notes' && <NotesPage />}
    </>
  )

  if (theme === 'aero-classic') {
    return (
      <>
        <ClassicShell session={session} route={route}>
          {page}
        </ClassicShell>
        <Assistant />
      </>
    )
  }

  const links = tabs.map((t) => (
    <a key={t.route} href={`#/${t.route}`} aria-current={route === t.route ? 'page' : undefined}>
      <span className="nav-icon" aria-hidden>
        {t.icon}
      </span>
      {t.label}
    </a>
  ))

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ✦
          </span>
          My To-do
        </div>
        {links}
        <ThemeSwitch />
        <div className="account">
          <div className="email">{session.user.email}</div>
          <button onClick={signOut}>Sign out</button>
        </div>
      </nav>
      <main className="content">{page}</main>
      <nav className="tabbar">
        {links}
        <ThemeSwitch compact />
      </nav>
      <Assistant />
    </div>
  )
}
