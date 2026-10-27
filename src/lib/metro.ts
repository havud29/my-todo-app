import { useSyncExternalStore } from 'react'

// Settings for the Windows Phone theme, kept in this browser like the theme
// itself: the accent color, a dark or light background, and tile sizes.

// The 20 accent colors of Windows Phone 8
export const accents = [
  { id: 'lime', hex: '#a4c400' },
  { id: 'green', hex: '#60a917' },
  { id: 'emerald', hex: '#008a00' },
  { id: 'teal', hex: '#00aba9' },
  { id: 'cyan', hex: '#1ba1e2' },
  { id: 'cobalt', hex: '#0050ef' },
  { id: 'indigo', hex: '#6a00ff' },
  { id: 'violet', hex: '#aa00ff' },
  { id: 'pink', hex: '#f472d0' },
  { id: 'magenta', hex: '#d80073' },
  { id: 'crimson', hex: '#a20025' },
  { id: 'red', hex: '#e51400' },
  { id: 'orange', hex: '#fa6800' },
  { id: 'amber', hex: '#f0a30a' },
  { id: 'yellow', hex: '#e3c800' },
  { id: 'brown', hex: '#825a2c' },
  { id: 'olive', hex: '#6d8764' },
  { id: 'steel', hex: '#647687' },
  { id: 'mauve', hex: '#76608a' },
  { id: 'taupe', hex: '#87794e' },
] as const

export type Accent = (typeof accents)[number]['id']
export type Background = 'dark' | 'light'
export type TileSize = 'small' | 'medium' | 'wide'

export interface MetroPrefs {
  accent: Accent
  background: Background
  sizes: Record<string, TileSize>
}

const key = 'metro'
const listeners = new Set<() => void>()
let current: MetroPrefs = { accent: 'cobalt', background: 'dark', sizes: {} }

try {
  const saved = JSON.parse(localStorage.getItem(key) ?? '{}')
  if (accents.some((a) => a.id === saved.accent)) current.accent = saved.accent
  if (saved.background === 'light') current.background = 'light'
  if (saved.sizes && typeof saved.sizes === 'object') current.sizes = saved.sizes
} catch {
  // storage can be blocked or hold junk; use the defaults
}
apply()

function apply() {
  const root = document.documentElement
  root.style.setProperty('--wp-accent', accents.find((a) => a.id === current.accent)!.hex)
  root.dataset.wpBg = current.background
}

export function setMetro(changes: Partial<MetroPrefs>) {
  current = { ...current, ...changes }
  apply()
  try {
    localStorage.setItem(key, JSON.stringify(current))
  } catch {
    // not saved, still applied for this visit
  }
  listeners.forEach((l) => l())
}

export const useMetro = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
