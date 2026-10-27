import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import Window from '../../components/Window'
import MilestoneDialog from './MilestoneDialog'
import { byTarget, countdown, progressOf } from './progress'
import { useMilestones } from './useMilestones'
import type { Milestone, Step } from './types'
import './milestones.css'

type Editing = { milestone?: Milestone } | null

export default function MilestonesPage() {
  const { milestones, steps, loading, error, reload, add, edit, remove, addStep, toggleStep } = useMilestones()
  const [editing, setEditing] = useState<Editing>(null)
  const [showAchieved, setShowAchieved] = useState(false)

  const active = milestones.filter((m) => !m.achieved_at).sort(byTarget)
  const achieved = milestones
    .filter((m) => m.achieved_at)
    .sort((a, b) => b.achieved_at!.localeCompare(a.achieved_at!))
  const stepsOf = (m: Milestone) => steps.filter((s) => s.milestone_id === m.id)

  return (
    <Window title="Milestones - My To-do" icon="milestones" className="milestones-window">
      <div className="milestones">
        <header className="ms-head">
          <h1 className="cal-title">Milestones</h1>
          <button className="primary" onClick={() => setEditing({})}>
            + New milestone
          </button>
        </header>

        {error && (
          <div className="banner">
            Couldn't sync your milestones: {error} <button onClick={reload}>Retry</button>
          </div>
        )}

        {!loading && active.length === 0 && (
          <div className="ms-empty">
            <p>Big goals take a while. Add one, like “Buy a new laptop”, then break it into steps.</p>
          </div>
        )}

        <div className="ms-grid">
          {active.map((m) => (
            <MilestoneCard
              key={m.id}
              milestone={m}
              steps={stepsOf(m)}
              onEdit={() => setEditing({ milestone: m })}
              onAchieve={() => edit(m.id, { achieved_at: new Date().toISOString() })}
              onAddStep={(title) => addStep(m, title)}
              onToggleStep={toggleStep}
            />
          ))}
        </div>

        {achieved.length > 0 && (
          <section className="ms-achieved">
            <button className="link-btn" onClick={() => setShowAchieved((s) => !s)} aria-expanded={showAchieved}>
              {showAchieved ? '▾' : '▸'} Achieved ({achieved.length})
            </button>
            {showAchieved && (
              <ul>
                {achieved.map((m) => (
                  <li key={m.id} className={`ms-trophy c-${m.color}`}>
                    <span className="ms-trophy-emoji">{m.emoji}</span>
                    <span className="ms-trophy-title">{m.title}</span>
                    <span className="ms-trophy-date">{format(new Date(m.achieved_at!), 'd MMM yyyy')}</span>
                    <button className="link-btn" onClick={() => edit(m.id, { achieved_at: null })}>
                      Reopen
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {editing && (
        <MilestoneDialog
          milestone={editing.milestone}
          onSave={(input) => (editing.milestone ? edit(editing.milestone.id, input) : add(input))}
          onDelete={editing.milestone ? () => remove(editing.milestone!.id) : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </Window>
  )
}

interface CardProps {
  milestone: Milestone
  steps: Step[]
  onEdit: () => void
  onAchieve: () => void
  onAddStep: (title: string) => Promise<void>
  onToggleStep: (s: Step) => void
}

function MilestoneCard({ milestone: m, steps, onEdit, onAchieve, onAddStep, onToggleStep }: CardProps) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const { done, total, pct } = progressOf(steps)
  const due = countdown(m)
  const ordered = [...steps].sort((a, b) => Number(a.done) - Number(b.done) || a.sort_order - b.sort_order)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    setAdding(true)
    try {
      await onAddStep(draft.trim())
      setDraft('')
    } finally {
      setAdding(false)
    }
  }

  return (
    <article className={`ms-card c-${m.color}`}>
      <header className="ms-card-head">
        <span className="ms-emoji" aria-hidden>
          {m.emoji}
        </span>
        <div className="ms-card-titles">
          <h2 className="ms-title">{m.title}</h2>
          {m.target_date && (
            <span className={`ms-when ${due?.overdue ? 'overdue' : ''}`}>
              by {format(parseISO(m.target_date), 'd MMM yyyy')} · {due?.label}
            </span>
          )}
        </div>
        <button className="icon-btn ms-edit" onClick={onEdit} aria-label={`Edit ${m.title}`}>
          ⋯
        </button>
      </header>

      {m.description && <p className="ms-desc">{m.description}</p>}

      <div className="ms-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="ms-progress-label">{total ? `${done} of ${total} steps · ${pct}%` : 'No steps yet'}</div>

      <ul className="ms-steps">
        {ordered.map((s) => (
          <li key={s.id} className={s.done ? 'done' : ''}>
            <label>
              <input type="checkbox" checked={s.done} onChange={() => onToggleStep(s)} />
              <span>{s.title}</span>
            </label>
          </li>
        ))}
      </ul>

      <form className="ms-add-step" onSubmit={submit}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="+ Add a step" disabled={adding} aria-label="New step" />
      </form>

      {total > 0 && done === total && (
        <button className="primary ms-achieve" onClick={onAchieve}>
          🏆 Mark as achieved
        </button>
      )}
    </article>
  )
}
