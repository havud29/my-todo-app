import { useEffect, useState } from 'react'

// Hash routes (#/notes) because GitHub Pages can't serve deep links
export type Route = 'notes' | 'calendar' | 'tasks'
const routes: Route[] = ['notes', 'calendar', 'tasks']

function read(): Route {
  const name = window.location.hash.replace(/^#\/?/, '')
  return (routes as string[]).includes(name) ? (name as Route) : 'tasks'
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(read)

  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}
