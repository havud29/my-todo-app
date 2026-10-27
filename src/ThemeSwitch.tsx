import { setTheme, themes, useTheme } from './lib/theme'

export default function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const theme = useTheme()

  if (compact) {
    const next = themes[(themes.findIndex((t) => t.id === theme) + 1) % themes.length]
    return (
      <button className="tab-like" onClick={() => setTheme(next.id)} aria-label={`Switch to ${next.label} theme`}>
        <span className="nav-icon" aria-hidden>
          ◐
        </span>
        {themes.find((t) => t.id === theme)?.label}
      </button>
    )
  }

  return (
    <div className="theme-switch">
      <div className="theme-label">Theme</div>
      <div className="segmented" role="radiogroup" aria-label="Theme">
        {themes.map((t) => (
          <button key={t.id} role="radio" aria-checked={theme === t.id} onClick={() => setTheme(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
