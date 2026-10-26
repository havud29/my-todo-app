import { useSyncExternalStore } from 'react'

export type Theme = 'aero-classic' | 'aero-modern'
export const themes: { id: Theme; label: string }[] = [
  { id: 'aero-classic', label: 'Classic' },
  { id: 'aero-modern', label: 'Modern' },
]

const key = 'theme'
const listeners = new Set<() => void>()
let current: Theme = 'aero-modern'

try {
  const t = localStorage.getItem(key)
  if (themes.some((x) => x.id === t)) current = t as Theme
} catch {
  // storage can be blocked; use the default
}
document.documentElement.dataset.theme = current

export function setTheme(theme: Theme) {
  current = theme
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(key, theme)
  } catch {
    // not saved, still applied for this visit
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useTheme = () => useSyncExternalStore(subscribe, () => current)
