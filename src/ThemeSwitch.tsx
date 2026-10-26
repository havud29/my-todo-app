import { setTheme, themes, useTheme, type Theme } from './lib/theme'

export default function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const theme = useTheme()
  const current = themes.find((t) => t.id === theme)
  const select = (
    <select
      className="theme-select"
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      aria-label="Theme"
    >
      {themes.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </select>
  )

  // On phones the tab shows the current theme and opens the native picker
  if (compact) {
    return (
      <label className="tab-like theme-tab">
        <span className="nav-icon" aria-hidden>
          ◐
        </span>
        {current?.label}
        {select}
      </label>
    )
  }

  return (
    <label className="theme-switch">
      <span className="theme-label">Theme</span>
      {select}
    </label>
  )
}
