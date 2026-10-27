import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import Window from '../../components/Window'
import { askAssistant } from './api'
import type { AssistantAction, ChatMessage } from './types'
import './assistant.css'

const storageKey = 'assistant-chat'
const suggestions = ["What's on my plate today?", 'Add a task to call mom tomorrow at 6pm', 'Plan my week']
const kindIcon: Record<AssistantAction['kind'], string> = { task: '✓', event: '◷', note: '✎', transaction: '¤', budget: '¤', milestone: '⚑' }
const kindLabel: Record<AssistantAction['kind'], string> = { task: 'task', event: 'event', note: 'note', transaction: '', budget: '', milestone: 'milestone' }

// Floating "Ask Claude" button and chat window. Claude's changes reach the
// pages through their live sync, so nothing here needs to refresh them.
export default function Assistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(load)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)))
    } catch {
      // not kept across reloads, which is fine
    }
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next)
    setDraft('')
    setBusy(true)
    try {
      const { reply, actions } = await askAssistant(next.filter((m) => !m.error))
      setMessages((ms) => [...ms, { role: 'assistant', content: reply, actions }])
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong'
      setMessages((ms) => [...ms, { role: 'assistant', content: message, error: true }])
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send(draft)
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send(draft)
    }
    if (e.key === 'Escape') setOpen(false)
  }

  if (!open) {
    return (
      <button className="assistant-fab" onClick={() => setOpen(true)} aria-label="Ask Claude">
        <img src={`${import.meta.env.BASE_URL}aero/assistant.svg`} alt="" />
        <span>Ask Claude</span>
      </button>
    )
  }

  return (
    <div className="assistant-panel">
      <Window title="Claude" icon="assistant" onClose={() => setOpen(false)}>
        <div className="assistant-inner">
          <header className="assistant-head">
            <strong>Claude</strong>
            {messages.length > 0 && (
              <button className="link-btn" onClick={() => setMessages([])} disabled={busy}>
                New chat
              </button>
            )}
            <button className="icon-btn assistant-close" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </header>

          <div className="assistant-log" ref={list} aria-live="polite">
            {messages.length === 0 && (
              <div className="assistant-empty">
                <p>Ask me about your day, or tell me what to add or change in your tasks, calendar, notes, milestones and budget.</p>
                <div className="assistant-suggestions">
                  {suggestions.map((s) => (
                    <button key={s} className="assistant-suggestion" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}${m.error ? ' error' : ''}`}>
                {m.role === 'assistant' ? <Rich text={m.content} /> : m.content}
                {m.actions && m.actions.length > 0 && (
                  <ul className="assistant-actions">
                    {m.actions.map((a, j) => (
                      <li key={j} className={a.verb}>
                        <span aria-hidden>{kindIcon[a.kind]}</span> {capitalize(a.verb)} {kindLabel[a.kind] ? `${kindLabel[a.kind]} “${a.title}”` : a.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {busy && (
              <div className="bubble assistant typing" aria-label="Claude is thinking">
                <i />
                <i />
                <i />
              </div>
            )}
          </div>

          <form className="assistant-form" onSubmit={submit}>
            <textarea
              ref={input}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder="Message Claude…"
              aria-label="Message Claude"
            />
            <button className="primary" type="submit" disabled={busy || !draft.trim()}>
              Send
            </button>
          </form>
        </div>
      </Window>
    </div>
  )
}

function load(): ChatMessage[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Just enough Markdown for chat replies: paragraphs, bullet lists, **bold**
function Rich({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let items: string[] = []
  const flush = () => {
    if (items.length) blocks.push(<ul key={blocks.length}>{items.map((t, i) => <li key={i}>{inline(t)}</li>)}</ul>)
    items = []
  }
  for (const line of text.split('\n')) {
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (bullet) {
      items.push(bullet[1])
      continue
    }
    flush()
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ''))}</p>)
  }
  flush()
  return <>{blocks}</>
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  )
}
