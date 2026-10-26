import { signOut } from './lib/supabase'
import { useSession } from './lib/useSession'
import { useHashRoute, type Route } from './lib/useHashRoute'
import SignIn from './SignIn'
import NotesPage from './features/notes/NotesPage'
import CalendarPage from './features/calendar/CalendarPage'
import TasksPage from './features/tasks/TasksPage'

const tabs: { route: Route; label: string }[] = [
  { route: 'tasks', label: 'Tasks' },
  { route: 'calendar', label: 'Calendar' },
  { route: 'notes', label: 'Notes' },
]

export default function App() {
  const session = useSession()
  const route = useHashRoute()

  if (session === undefined) return <main className="loading">Loading…</main>
  if (!session) return <SignIn />

  return (
    <div className="shell">
      <header>
        <nav>
          {tabs.map((t) => (
            <a key={t.route} href={`#/${t.route}`} aria-current={route === t.route ? 'page' : undefined}>
              {t.label}
            </a>
          ))}
        </nav>
        <span className="user">{session.user.email}</span>
        <button onClick={signOut}>Sign out</button>
      </header>
      <main>
        {route === 'notes' && <NotesPage />}
        {route === 'calendar' && <CalendarPage />}
        {route === 'tasks' && <TasksPage />}
      </main>
    </div>
  )
}
