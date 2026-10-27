import { useCallback, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import Window from '../../components/Window'
import { createLink, listLinks, revokeLink } from './api'
import type { ConnectorLink } from './types'
import './assistant.css'

const examples = ["What's on my calendar this week?", 'Add a task to call mom tomorrow at 6pm', 'How much did I spend on food this month?']

// Floating "Claude" button and a window that sets up the app as a custom
// connector in Claude, so the user chats in the Claude app on their own plan.
export default function ConnectClaude() {
  const [open, setOpen] = useState(false)
  const [links, setLinks] = useState<ConnectorLink[]>([])
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setLinks(await listLinks())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your links')
    }
  }, [])

  async function make() {
    setBusy(true)
    setError(null)
    try {
      const { link, url } = await createLink()
      setLinks((ls) => [link, ...ls])
      setFresh(url)
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make a link')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!fresh) return
    try {
      await navigator.clipboard.writeText(fresh)
      setCopied(true)
    } catch {
      // clipboard blocked; the field is selectable
    }
  }

  async function remove(id: string) {
    setLinks((ls) => ls.filter((l) => l.id !== id))
    try {
      await revokeLink(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the link')
      reload()
    }
  }

  if (!open) {
    return (
      <button
        className="assistant-fab"
        onClick={() => {
          setOpen(true)
          reload()
        }}
        aria-label="Use with Claude"
      >
        <img src={`${import.meta.env.BASE_URL}aero/assistant.svg`} alt="" />
        <span>Claude</span>
      </button>
    )
  }

  return (
    <div className="assistant-panel" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <Window title="Use with Claude" icon="assistant" onClose={() => setOpen(false)}>
        <div className="assistant-inner">
          <header className="assistant-head">
            <strong>Use with Claude</strong>
            <button className="icon-btn assistant-close" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </header>

          <div className="assistant-body">
            <p className="assistant-lead">
              Chat with Claude in the Claude app or on claude.ai, and it can add and change your tasks, events, notes,
              milestones and budget here. This works on your own Claude plan, including Pro.
            </p>

            <ol className="assistant-steps">
              <li>
                <strong>Make a private link</strong>
                {fresh ? (
                  <div className="assistant-link">
                    <input readOnly value={fresh} onFocus={(e) => e.target.select()} aria-label="Connector link" />
                    <button className="primary" onClick={copy}>
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <button className="primary" onClick={make} disabled={busy}>
                    {busy ? 'Making…' : 'Make link'}
                  </button>
                )}
                {fresh && <small>This link is shown only once. Anyone who has it can see and change your data, so keep it private.</small>}
              </li>
              <li>
                <strong>Add it to Claude</strong>
                <span>
                  In{' '}
                  <a href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer">
                    Claude → Settings → Connectors
                  </a>
                  , choose <em>Add custom connector</em>, name it <em>My To-do</em> and paste the link.
                </span>
              </li>
              <li>
                <strong>Ask away</strong>
                <span>In any chat, try:</span>
                <ul>
                  {examples.map((x) => (
                    <li key={x}>“{x}”</li>
                  ))}
                </ul>
              </li>
            </ol>

            {error && <p className="assistant-error">{error}</p>}

            {links.length > 0 && (
              <section className="assistant-links">
                <h3>Your links</h3>
                {links.map((l) => (
                  <div key={l.id} className="assistant-link-row">
                    <span>
                      Made {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      <small>
                        {l.last_used_at
                          ? `Last used ${formatDistanceToNow(new Date(l.last_used_at), { addSuffix: true })}`
                          : 'Not used yet'}
                      </small>
                    </span>
                    <button className="danger" onClick={() => remove(l.id)}>
                      Remove
                    </button>
                  </div>
                ))}
                {fresh === null && <small>Lost a link? Remove it and make a new one.</small>}
              </section>
            )}
          </div>
        </div>
      </Window>
    </div>
  )
}
