// Supabase Edge Function: chat with Claude, who can read and change the
// signed-in user's tasks, events, notes, milestones and budget through tools.
//
// The Anthropic API key lives only here, as the ANTHROPIC_API_KEY secret.
// Database calls run with the caller's own access token, so row-level
// security limits Claude to that user's rows, exactly like the web app.
//
// Kept to one file so it can also be pasted into the Supabase dashboard editor.

import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'

const MODEL = 'claude-opus-5-5'
const MAX_STEPS = 10 // tool rounds per message
const MAX_HISTORY = 30 // messages kept from the chat

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// ---------------------------------------------------------------- tools

type Input = Record<string, unknown>
type Ctx = { db: SupabaseClient; done: Action[]; today: string } // today is YYYY-MM-DD in the user's zone
// Something Claude changed, shown under its reply
type Action = { kind: 'task' | 'event' | 'note' | 'transaction' | 'budget' | 'milestone'; verb: 'added' | 'updated' | 'deleted'; title: string }

const isoField = (what: string) => ({
  type: 'string',
  description: `${what} as ISO 8601 with the user's UTC offset, e.g. 2026-11-03T09:00:00+07:00`,
})

const tools: Anthropic.Tool[] = [
  {
    name: 'list_tasks',
    description: 'List the user\'s tasks. Use before updating or deleting so you have the right id.',
    input_schema: {
      type: 'object',
      properties: { include_done: { type: 'boolean', description: 'Also return completed tasks. Default false.' } },
    },
  },
  {
    name: 'create_task',
    description: 'Add a to-do task.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        notes: { type: 'string', description: 'Longer details' },
        list: { type: 'string', description: 'List name, default "Inbox". Reuse an existing list when one fits.' },
        due_at: isoField('Due date and time'),
        priority: { type: 'integer', enum: [0, 1, 2, 3], description: '0 none, 1 low, 2 medium, 3 high' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Change a task, including marking it done or not done. Only the fields given are changed.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        notes: { type: 'string' },
        list: { type: 'string' },
        due_at: { ...isoField('Due date and time'), type: ['string', 'null'] },
        priority: { type: 'integer', enum: [0, 1, 2, 3] },
        done: { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'list_events',
    description:
      'List calendar events that may fall between two moments. Repeating events are returned once, with an RRULE in "recurrence" and their first start in "starts_at".',
    input_schema: {
      type: 'object',
      properties: { from: isoField('Range start'), to: isoField('Range end') },
      required: ['from', 'to'],
    },
  },
  {
    name: 'create_event',
    description:
      'Add a calendar event. For all-day events set all_day true and use local midnight of the first day for starts_at and of the last day (inclusive) for ends_at.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        starts_at: isoField('Start'),
        ends_at: isoField('End (defaults to one hour after start for timed events)'),
        all_day: { type: 'boolean' },
        description: { type: 'string' },
        location: { type: 'string' },
        recurrence: {
          type: 'string',
          enum: ['FREQ=DAILY', 'FREQ=WEEKLY', 'FREQ=MONTHLY', 'FREQ=YEARLY'],
          description: 'Omit for a one-off event',
        },
        color: { type: 'string', enum: ['violet', 'blue', 'teal', 'green', 'amber', 'rose'] },
      },
      required: ['title', 'starts_at'],
    },
  },
  {
    name: 'update_event',
    description: 'Change an event. Only the fields given are changed. Pass recurrence null to stop it repeating.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        starts_at: isoField('Start'),
        ends_at: { ...isoField('End'), type: ['string', 'null'] },
        all_day: { type: 'boolean' },
        description: { type: 'string' },
        location: { type: ['string', 'null'] },
        recurrence: { type: ['string', 'null'], enum: ['FREQ=DAILY', 'FREQ=WEEKLY', 'FREQ=MONTHLY', 'FREQ=YEARLY', null] },
        color: { type: 'string', enum: ['violet', 'blue', 'teal', 'green', 'amber', 'rose'] },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_event',
    description: 'Delete an event, including every repeat of it.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'search_notes',
    description: 'Find notes by words in the title or body. Without a query, returns the most recently edited notes.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } } },
  },
  {
    name: 'create_note',
    description: 'Write a new note. The body is plain text or Markdown.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        pinned: { type: 'boolean' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_note',
    description:
      'Change a note. Only the fields given are changed. To add to a note, read it with search_notes and send the whole new body.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        pinned: { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_note',
    description: 'Delete a note.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'list_transactions',
    description: 'List money transactions (expenses and income), newest first. Amounts are in the user\'s own currency.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'First day, YYYY-MM-DD' },
        to: { type: 'string', description: 'Last day (inclusive), YYYY-MM-DD' },
        kind: { type: 'string', enum: ['expense', 'income'] },
        category: { type: 'string' },
      },
    },
  },
  {
    name: 'create_transaction',
    description:
      'Record money spent or received. Expense categories: Food, Transport, Housing, Bills, Shopping, Health, Fun, Other. Income categories: Salary, Freelance, Gift, Other. Use one of these unless the user names another.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['expense', 'income'], description: 'Default expense' },
        amount: { type: 'number', exclusiveMinimum: 0 },
        category: { type: 'string' },
        note: { type: 'string', description: 'What it was for' },
        occurred_on: { type: 'string', description: 'YYYY-MM-DD, default today' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'update_transaction',
    description: 'Change a transaction. Only the fields given are changed.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        kind: { type: 'string', enum: ['expense', 'income'] },
        amount: { type: 'number', exclusiveMinimum: 0 },
        category: { type: 'string' },
        note: { type: 'string' },
        occurred_on: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_transaction',
    description: 'Delete a transaction.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'budget_summary',
    description:
      'Totals for one month: income, spending, spending per category, and each category\'s monthly limit. Use this for questions like "how much have I spent" or "am I over budget".',
    input_schema: {
      type: 'object',
      properties: { month: { type: 'string', description: 'YYYY-MM, default the current month' } },
    },
  },
  {
    name: 'set_budget',
    description: 'Set or change the monthly spending limit for an expense category.',
    input_schema: {
      type: 'object',
      properties: { category: { type: 'string' }, monthly_limit: { type: 'number', exclusiveMinimum: 0 } },
      required: ['category', 'monthly_limit'],
    },
  },
  {
    name: 'remove_budget',
    description: 'Remove the monthly limit for a category.',
    input_schema: { type: 'object', properties: { category: { type: 'string' } }, required: ['category'] },
  },
  {
    name: 'list_milestones',
    description:
      'List long-term goals (milestones, like "buy a laptop") with their target dates and steps. Steps are tasks; tick them with update_task.',
    input_schema: {
      type: 'object',
      properties: { include_achieved: { type: 'boolean', description: 'Also return achieved milestones. Default false.' } },
    },
  },
  {
    name: 'create_milestone',
    description: 'Add a long-term goal, optionally with its first steps.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        emoji: { type: 'string', description: 'One emoji, default 🎯' },
        color: { type: 'string', enum: ['violet', 'blue', 'teal', 'green', 'amber', 'rose'] },
        target_date: { type: 'string', description: 'YYYY-MM-DD' },
        steps: { type: 'array', items: { type: 'string' }, description: 'Step titles, in order' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_milestone',
    description: 'Change a milestone, or mark it achieved (achieved true) or not yet (achieved false). Only the fields given are changed.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        emoji: { type: 'string' },
        color: { type: 'string', enum: ['violet', 'blue', 'teal', 'green', 'amber', 'rose'] },
        target_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
        achieved: { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_milestone_steps',
    description: 'Add steps to a milestone. Each step becomes a task in a list named after the milestone.',
    input_schema: {
      type: 'object',
      properties: {
        milestone_id: { type: 'string' },
        steps: {
          type: 'array',
          items: { type: 'object', properties: { title: { type: 'string' }, due_at: isoField('Due date and time') }, required: ['title'] },
        },
      },
      required: ['milestone_id', 'steps'],
    },
  },
  {
    name: 'delete_milestone',
    description: 'Delete a milestone. Its steps stay as ordinary tasks.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
]

const pick = (input: Input, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]))

const taskCols = 'id,title,notes,list,done,due_at,priority'
const eventCols = 'id,title,description,location,starts_at,ends_at,all_day,recurrence,color'
const noteCols = 'id,title,body,tags,pinned,updated_at'
const milestoneCols = 'id,title,description,emoji,color,target_date,achieved_at'
const txCols = 'id,kind,amount,category,note,occurred_on'
const txFields = ['kind', 'amount', 'category', 'note', 'occurred_on']

async function run<T>(query: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

// Soft delete, like the app, so other devices learn about it when they sync
const softDelete = (db: SupabaseClient, table: string, id: unknown) =>
  run(db.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id).select('title').single())

const handlers: Record<string, (input: Input, ctx: Ctx) => Promise<unknown>> = {
  async list_tasks(input, { db }) {
    let q = db.from('tasks').select(taskCols).is('deleted_at', null).order('created_at').limit(300)
    if (!input.include_done) q = q.eq('done', false)
    return run(q)
  },
  async create_task(input, { db, done }) {
    const row = await run(
      db
        .from('tasks')
        .insert({ ...pick(input, ['title', 'notes', 'list', 'due_at', 'priority']), sort_order: Date.now() })
        .select(taskCols)
        .single(),
    )
    done.push({ kind: 'task', verb: 'added', title: String(input.title) })
    return row
  },
  async update_task(input, { db, done }) {
    const patch: Input = pick(input, ['title', 'notes', 'list', 'due_at', 'priority', 'done'])
    if (typeof input.done === 'boolean') patch.done_at = input.done ? new Date().toISOString() : null
    const row = await run(db.from('tasks').update(patch).eq('id', input.id).select(taskCols).single())
    done.push({ kind: 'task', verb: 'updated', title: (row as { title: string }).title })
    return row
  },
  async delete_task(input, { db, done }) {
    const row = await softDelete(db, 'tasks', input.id)
    done.push({ kind: 'task', verb: 'deleted', title: (row as { title: string }).title })
    return { ok: true }
  },

  async list_events(input, { db }) {
    const from = new Date(String(input.from)).toISOString()
    const to = new Date(String(input.to)).toISOString()
    return run(
      db
        .from('events')
        .select(eventCols)
        .is('deleted_at', null)
        .lt('starts_at', to)
        .or(`recurrence.not.is.null,ends_at.gte."${from}",starts_at.gte."${from}"`)
        .order('starts_at')
        .limit(300),
    )
  },
  async create_event(input, { db, done }) {
    const row = pick(input, ['title', 'starts_at', 'ends_at', 'all_day', 'description', 'location', 'recurrence', 'color'])
    if (!row.ends_at && !row.all_day) row.ends_at = new Date(new Date(String(row.starts_at)).getTime() + 3_600_000).toISOString()
    const saved = await run(db.from('events').insert(row).select(eventCols).single())
    done.push({ kind: 'event', verb: 'added', title: String(input.title) })
    return saved
  },
  async update_event(input, { db, done }) {
    const patch = pick(input, ['title', 'starts_at', 'ends_at', 'all_day', 'description', 'location', 'recurrence', 'color'])
    const row = await run(db.from('events').update(patch).eq('id', input.id).select(eventCols).single())
    done.push({ kind: 'event', verb: 'updated', title: (row as { title: string }).title })
    return row
  },
  async delete_event(input, { db, done }) {
    const row = await softDelete(db, 'events', input.id)
    done.push({ kind: 'event', verb: 'deleted', title: (row as { title: string }).title })
    return { ok: true }
  },

  async search_notes(input, { db }) {
    let q = db.from('notes').select(noteCols).is('deleted_at', null).order('updated_at', { ascending: false }).limit(20)
    const query = typeof input.query === 'string' ? input.query.trim() : ''
    if (query) q = q.textSearch('fts', query, { type: 'websearch', config: 'simple' })
    return run(q)
  },
  async create_note(input, { db, done }) {
    const row = await run(db.from('notes').insert(pick(input, ['title', 'body', 'tags', 'pinned'])).select(noteCols).single())
    done.push({ kind: 'note', verb: 'added', title: String(input.title) })
    return row
  },
  async update_note(input, { db, done }) {
    const row = await run(
      db.from('notes').update(pick(input, ['title', 'body', 'tags', 'pinned'])).eq('id', input.id).select(noteCols).single(),
    )
    done.push({ kind: 'note', verb: 'updated', title: (row as { title: string }).title || 'Untitled note' })
    return row
  },
  async delete_note(input, { db, done }) {
    const row = await softDelete(db, 'notes', input.id)
    done.push({ kind: 'note', verb: 'deleted', title: (row as { title: string }).title || 'Untitled note' })
    return { ok: true }
  },

  async list_milestones(input, { db }) {
    let q = db.from('milestones').select(milestoneCols).is('deleted_at', null).order('target_date', { nullsFirst: false })
    if (!input.include_achieved) q = q.is('achieved_at', null)
    const milestones = (await run(q)) as { id: string }[]
    if (!milestones.length) return []
    const steps = (await run(
      db
        .from('tasks')
        .select('id,title,done,due_at,milestone_id')
        .is('deleted_at', null)
        .in('milestone_id', milestones.map((m) => m.id))
        .order('sort_order'),
    )) as { milestone_id: string }[]
    return milestones.map((m) => ({ ...m, steps: steps.filter((s) => s.milestone_id === m.id) }))
  },
  async create_milestone(input, { db, done }) {
    const row = (await run(
      db.from('milestones').insert(pick(input, ['title', 'description', 'emoji', 'color', 'target_date'])).select(milestoneCols).single(),
    )) as { id: string; title: string }
    done.push({ kind: 'milestone', verb: 'added', title: row.title })
    const titles = Array.isArray(input.steps) ? input.steps.map(String).filter(Boolean) : []
    const steps = titles.length ? await insertSteps(db, row, titles.map((title) => ({ title }))) : []
    return { ...row, steps }
  },
  async update_milestone(input, { db, done }) {
    const patch: Input = pick(input, ['title', 'description', 'emoji', 'color', 'target_date'])
    if (typeof input.achieved === 'boolean') patch.achieved_at = input.achieved ? new Date().toISOString() : null
    const row = (await run(db.from('milestones').update(patch).eq('id', input.id).select(milestoneCols).single())) as {
      title: string
    }
    done.push({ kind: 'milestone', verb: 'updated', title: row.title })
    return row
  },
  async add_milestone_steps(input, { db, done }) {
    const milestone = (await run(db.from('milestones').select('id,title').eq('id', input.milestone_id).single())) as {
      id: string
      title: string
    }
    const steps = Array.isArray(input.steps) ? (input.steps as Input[]).filter((s) => s?.title) : []
    const rows = await insertSteps(db, milestone, steps)
    done.push({ kind: 'milestone', verb: 'updated', title: milestone.title })
    return rows
  },
  async delete_milestone(input, { db, done }) {
    const row = await softDelete(db, 'milestones', input.id)
    await run(db.from('tasks').update({ milestone_id: null }).eq('milestone_id', input.id).select('id'))
    done.push({ kind: 'milestone', verb: 'deleted', title: (row as { title: string }).title })
    return { ok: true }
  },

  async list_transactions(input, { db }) {
    let q = db.from('transactions').select(txCols).is('deleted_at', null).order('occurred_on', { ascending: false }).limit(300)
    if (input.from) q = q.gte('occurred_on', input.from)
    if (input.to) q = q.lte('occurred_on', input.to)
    if (input.kind) q = q.eq('kind', input.kind)
    if (input.category) q = q.ilike('category', likeExact(String(input.category)))
    return run(q)
  },
  async create_transaction(input, { db, done }) {
    const row = await run(db.from('transactions').insert(pick(input, txFields)).select(txCols).single())
    done.push({ kind: 'transaction', verb: 'added', title: txTitle(row) })
    return row
  },
  async update_transaction(input, { db, done }) {
    const row = await run(db.from('transactions').update(pick(input, txFields)).eq('id', input.id).select(txCols).single())
    done.push({ kind: 'transaction', verb: 'updated', title: txTitle(row) })
    return row
  },
  async delete_transaction(input, { db, done }) {
    const row = await run(
      db.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', input.id).select(txCols).single(),
    )
    done.push({ kind: 'transaction', verb: 'deleted', title: txTitle(row) })
    return { ok: true }
  },
  async budget_summary(input, { db, today }) {
    const month = /^\d{4}-\d{2}$/.test(String(input.month)) ? String(input.month) : today.slice(0, 7)
    const [y, m] = month.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    const [txs, budgets] = await Promise.all([
      run(
        db
          .from('transactions')
          .select('kind,amount,category')
          .is('deleted_at', null)
          .gte('occurred_on', `${month}-01`)
          .lt('occurred_on', `${next}-01`),
      ) as Promise<{ kind: string; amount: number | string; category: string }[]>,
      run(db.from('budgets').select('category,monthly_limit').is('deleted_at', null)) as Promise<
        { category: string; monthly_limit: number | string }[]
      >,
    ])
    const round = (n: number) => Math.round(n * 100) / 100
    let income = 0
    let spent = 0
    const byCategory: Record<string, { spent: number; limit: number | null }> = {}
    for (const b of budgets) byCategory[b.category] = { spent: 0, limit: Number(b.monthly_limit) }
    for (const t of txs) {
      const amount = Number(t.amount)
      if (t.kind === 'income') {
        income += amount
        continue
      }
      spent += amount
      const key = Object.keys(byCategory).find((k) => k.toLowerCase() === t.category.toLowerCase()) ?? t.category
      byCategory[key] ??= { spent: 0, limit: null }
      byCategory[key].spent += amount
    }
    for (const c of Object.values(byCategory)) c.spent = round(c.spent)
    return { month, income: round(income), spent: round(spent), left: round(income - spent), by_category: byCategory }
  },
  async set_budget(input, { db, done }) {
    const existing = (await run(
      db.from('budgets').select('id,category').is('deleted_at', null).ilike('category', likeExact(String(input.category).trim())).limit(1),
    )) as { id: string; category: string }[]
    const category = existing[0]?.category ?? String(input.category).trim()
    const row = existing.length
      ? await run(db.from('budgets').update({ monthly_limit: input.monthly_limit }).eq('id', existing[0].id).select().single())
      : await run(db.from('budgets').insert({ category, monthly_limit: input.monthly_limit }).select().single())
    done.push({ kind: 'budget', verb: existing.length ? 'updated' : 'added', title: `${category} limit ${input.monthly_limit}` })
    return row
  },
  async remove_budget(input, { db, done }) {
    const category = String(input.category).trim()
    const rows = (await run(
      db
        .from('budgets')
        .update({ deleted_at: new Date().toISOString() })
        .is('deleted_at', null)
        .ilike('category', likeExact(category))
        .select('id'),
    )) as { id: string }[]
    if (!rows.length) throw new Error(`No limit is set for ${category}`)
    done.push({ kind: 'budget', verb: 'deleted', title: `${category} limit` })
    return { ok: true }
  },
}

// Steps are tasks filed in a list named after their milestone, like the app does
function insertSteps(db: SupabaseClient, milestone: { id: string; title: string }, steps: Input[]) {
  const base = Date.now()
  return run(
    db
      .from('tasks')
      .insert(steps.map((s, i) => ({ title: s.title, due_at: s.due_at, list: milestone.title, milestone_id: milestone.id, sort_order: base + i })))
      .select('id,title,done,due_at'),
  )
}

// Case-insensitive equality through ilike, with its wildcards escaped
const likeExact = (s: string) => s.replace(/[\\%_]/g, '\\$&')

// e.g. "Expense 12.5 · Food · lunch"
const txTitle = (row: unknown) => {
  const t = row as { kind: string; amount: number; category: string; note: string }
  return [`${t.kind === 'income' ? 'Income' : 'Expense'} ${t.amount}`, t.category, t.note].filter(Boolean).join(' · ')
}

// ---------------------------------------------------------------- prompt

const instructions = `You are the assistant inside the user's personal to-do app, which has Tasks, a Calendar, Notes, Milestones (long-term goals broken into steps) and a Budget for tracking money.
You can read and change their data with the tools. Act on clear requests straight away instead of asking for confirmation; ask a short question only when a request is genuinely ambiguous (for example, which of two similar tasks to delete).
Before updating or deleting, look the item up so you use its real id. Never invent ids. Amounts have no currency stored; write them the way the user does.
Interpret dates and times in the user's time zone, given below, and always send times with their UTC offset.
Reply briefly and warmly in plain sentences, in the language the user writes in. After making changes, say what you did in one or two lines. Use Markdown lists only when listing several items.`

function localDate(tz: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function context(tz: string, now: string) {
  return `The user's time zone is ${tz}. Their current local date and time is ${now}.`
}

// ---------------------------------------------------------------- handler

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function readHistory(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null
  const msgs = raw
    .filter(
      (m): m is ChatMessage =>
        (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== '',
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
    .slice(-MAX_HISTORY)
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()
  return msgs.length && msgs[msgs.length - 1].role === 'user' ? msgs : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'missing_key', message: 'ANTHROPIC_API_KEY is not set on the server.' }, 500)

  const auth = req.headers.get('Authorization') ?? ''
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const { data: user } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ''))
  if (!user?.user) return json({ error: 'unauthorized', message: 'Please sign in again.' }, 401)

  const body = await req.json().catch(() => null)
  const history = readHistory(body?.messages)
  if (!history) return json({ error: 'bad_request', message: 'Send a conversation that ends with a user message.' }, 400)
  const tz = typeof body?.timezone === 'string' ? body.timezone.slice(0, 64) : 'UTC'
  const now = typeof body?.now === 'string' ? body.now.slice(0, 64) : new Date().toISOString()

  const client = new Anthropic({ apiKey })
  const messages: Anthropic.Beta.BetaMessageParam[] = history
  const ctx: Ctx = { db, done: [], today: localDate(tz) }

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        tools,
        system: [
          { type: 'text', text: instructions, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: context(tz, now) },
        ],
        messages,
      })

      if (response.stop_reason === 'refusal') {
        return json({ reply: "Sorry, I can't help with that one.", actions: ctx.done })
      }

      const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
      if (response.stop_reason !== 'tool_use' || calls.length === 0) {
        const reply = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim()
        return json({ reply: reply || 'Done.', actions: ctx.done })
      }

      messages.push({ role: 'assistant', content: response.content })
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
        calls.map(async (call) => {
          const handler = handlers[call.name]
          try {
            if (!handler) throw new Error(`Unknown tool ${call.name}`)
            const out = await handler((call.input ?? {}) as Input, ctx)
            return { type: 'tool_result' as const, tool_use_id: call.id, content: JSON.stringify(out) }
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e)
            return { type: 'tool_result' as const, tool_use_id: call.id, content: message, is_error: true }
          }
        }),
      )
      messages.push({ role: 'user', content: results })
    }
    return json({ reply: 'That took more steps than I allow in one go. Tell me what to continue with.', actions: ctx.done })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return json({ error: 'bad_key', message: 'The Anthropic API key was rejected. Check the ANTHROPIC_API_KEY secret.' }, 502)
    }
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: 'rate_limited', message: 'Claude is busy right now. Try again in a minute.' }, 429)
    }
    if (e instanceof Anthropic.APIError) {
      return json({ error: 'api_error', message: `Claude API error ${e.status}: ${e.message}`, actions: ctx.done }, 502)
    }
    throw e
  }
})
