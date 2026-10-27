import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { accents, setMetro, useMetro } from '../lib/metro'
import { setTheme, themes } from '../lib/theme'
import { signOut } from '../lib/supabase'

// Settings > theme, as on the phone: background and accent color pickers,
// then a way back to the other themes.
export default function MetroSettings({ session }: { session: Session }) {
  const { accent, background } = useMetro()
  const [picking, setPicking] = useState<'background' | 'accent' | null>(null)
  const current = accents.find((a) => a.id === accent)!

  return (
    <div className="wp-settings">
      <p className="wp-hint">Change the background and accent color to match your mood today, this week, or all month.</p>

      <div className="wp-field">
        <span className="wp-label">Background</span>
        {picking === 'background' ? (
          <div className="listpicker open" role="listbox" aria-label="Background">
            {(['dark', 'light'] as const).map((b) => (
              <button
                key={b}
                role="option"
                aria-selected={background === b}
                onClick={() => {
                  setMetro({ background: b })
                  setPicking(null)
                }}
              >
                {b}
              </button>
            ))}
          </div>
        ) : (
          <button className="listpicker" onClick={() => setPicking('background')}>
            {background}
          </button>
        )}
      </div>

      <div className="wp-field">
        <span className="wp-label">Accent color</span>
        {picking === 'accent' ? (
          <div className="accent-grid" role="listbox" aria-label="Accent color">
            {accents.map((a) => (
              <button
                key={a.id}
                role="option"
                aria-selected={accent === a.id}
                aria-label={a.id}
                title={a.id}
                style={{ background: a.hex }}
                onClick={() => {
                  setMetro({ accent: a.id })
                  setPicking(null)
                }}
              />
            ))}
          </div>
        ) : (
          <button className="listpicker" onClick={() => setPicking('accent')}>
            <span className="accent-chip" style={{ background: current.hex }} />
            {current.id}
          </button>
        )}
      </div>

      <div className="wp-field">
        <span className="wp-label">Other themes</span>
        <div className="wp-links">
          {themes
            .filter((t) => t.id !== 'metro')
            .map((t) => (
              <button key={t.id} className="wp-link" onClick={() => setTheme(t.id)}>
                {t.label.toLowerCase()}
              </button>
            ))}
        </div>
      </div>

      <div className="wp-field">
        <span className="wp-label">Account</span>
        <span className="wp-value">{session.user.email}</span>
        <button className="wp-link" onClick={signOut}>
          sign out
        </button>
      </div>
    </div>
  )
}
