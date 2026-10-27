import { useEffect, useState } from 'react'
import { defaultRoute, pages, type Route } from './nav'

export type { Route }

// Hash routes (#/notes) because GitHub Pages can't serve deep links
const routes: string[] = pages.map((p) => p.route)

function read(): Route {
  const name = window.location.hash.replace(/^#\/?/, '')
  return routes.includes(name) ? (name as Route) : defaultRoute
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
