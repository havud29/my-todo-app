// Supabase Edge Function: a remote MCP server, so Claude (claude.ai, the
// desktop and phone apps) can read and change the user's tasks, events,
// notes, milestones and budget. Added in Claude as a custom connector, so it
// runs on the user's own Claude plan with no API key.
//
// The connector URL ends in a private token made on the app's Claude panel.
// Only its SHA-256 hash is stored (public.connector_tokens). Claude can't
// send the user's Supabase session, so this function uses the service role
// key, and every query goes through scoped(), which pins it to the token's
// owner. Deploy with JWT verification off (see supabase/config.toml).
//
// Kept to one file so it can also be pasted into the Supabase dashboard editor.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// ---------------------------------------------------------------- tools

type Input = Record<string, unknown>
type Ctx = { db: Db; today: string } // today is YYYY-MM-DD in the user's zone
type Tool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean }
}

// Every query goes through this, so each one only sees the link owner's rows
function scoped(admin: SupabaseClient, userId: string) {
  const own = (row: Input) => ({ ...row, user_id: userId })
  return {
    // Rows come back untyped; handlers hand them to Claude as JSON
    select: (table: string, columns: string) => admin.from(table).select<string, Record<string, unknown>>(columns).eq('user_id', userId),
    insert: (table: string, rows: Input | Input[]) => admin.from(table).insert(Array.isArray(rows) ? rows.map(own) : own(rows)),
    update: (table: string, patch: Input) => admin.from(table).update(patch).eq('user_id', userId),
  }
}
type Db = ReturnType<typeof scoped>

const isoField = (what: string) => ({
  type: 'string',
  description: `${what} as ISO 8601 with the user's UTC offset, e.g. 2026-11-03T09:00:00+07:00`,
})

const tools: Tool[] = [
  {
    name: 'list_tasks',
    description: 'List the user\'s tasks. Use before updating or deleting so you have the right id.',
    inputSchema: {
      type: 'object',
      properties: { include_done: { type: 'boolean', description: 'Also return completed tasks. Default false.' } },
    },
  },
  {
    name: 'create_task',
    description: 'Add a to-do task.',
    inputSchema: {
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
    inputSchema: {
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
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'list_events',
    description:
      'List calendar events that may fall between two moments. Repeating events are returned once, with an RRULE in "recurrence" and their first start in "starts_at".',
    inputSchema: {
      type: 'object',
      properties: { from: isoField('Range start'), to: isoField('Range end') },
      required: ['from', 'to'],
    },
  },
  {
    name: 'create_event',
    description:
      'Add a calendar event. For all-day events set all_day true and use local midnight of the first day for starts_at and of the last day (inclusive) for ends_at.',
    inputSchema: {
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
    inputSchema: {
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
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'search_notes',
    description: 'Find notes by words in the title or body. Without a query, returns the most recently edited notes.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
  },
  {
    name: 'create_note',
    description: 'Write a new note. The body is plain text or Markdown.',
    inputSchema: {
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
    inputSchema: {
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
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'list_transactions',
    description: 'List money transactions (expenses and income), newest first. Amounts are in the user\'s own currency.',
    inputSchema: {
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
    inputSchema: {
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
    inputSchema: {
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
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'budget_summary',
    description:
      'Totals for one month: income, spending, spending per category, and each category\'s monthly limit. Use this for questions like "how much have I spent" or "am I over budget".',
    inputSchema: {
      type: 'object',
      properties: { month: { type: 'string', description: 'YYYY-MM, default the current month' } },
    },
  },
  {
    name: 'set_budget',
    description: 'Set or change the monthly spending limit for an expense category.',
    inputSchema: {
      type: 'object',
      properties: { category: { type: 'string' }, monthly_limit: { type: 'number', exclusiveMinimum: 0 } },
      required: ['category', 'monthly_limit'],
    },
  },
  {
    name: 'remove_budget',
    description: 'Remove the monthly limit for a category.',
    inputSchema: { type: 'object', properties: { category: { type: 'string' } }, required: ['category'] },
  },
  {
    name: 'list_milestones',
    description:
      'List long-term goals (milestones, like "buy a laptop") with their target dates and steps. Steps are tasks; tick them with update_task.',
    inputSchema: {
      type: 'object',
      properties: { include_achieved: { type: 'boolean', description: 'Also return achieved milestones. Default false.' } },
    },
  },
  {
    name: 'create_milestone',
    description: 'Add a long-term goal, optionally with its first steps.',
    inputSchema: {
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
    inputSchema: {
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
    inputSchema: {
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
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
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
const softDelete = (db: Db, table: string, id: unknown) =>
  run(db.update(table, { deleted_at: new Date().toISOString() }).eq('id', id).select('id').single())

const handlers: Record<string, (input: Input, ctx: Ctx) => Promise<unknown>> = {
  async list_tasks(input, { db }) {
    let q = db.select('tasks', taskCols).is('deleted_at', null).order('created_at').limit(300)
    if (!input.include_done) q = q.eq('done', false)
    return run(q)
  },
  async create_task(input, { db }) {
    const row = await run(
      db.insert('tasks', { ...pick(input, ['title', 'notes', 'list', 'due_at', 'priority']), sort_order: Date.now() })
        .select(taskCols)
        .single(),
    )
    return row
  },
  async update_task(input, { db }) {
    const patch: Input = pick(input, ['title', 'notes', 'list', 'due_at', 'priority', 'done'])
    if (typeof input.done === 'boolean') patch.done_at = input.done ? new Date().toISOString() : null
    const row = await run(db.update('tasks', patch).eq('id', input.id).select(taskCols).single())
    return row
  },
  async delete_task(input, { db }) {
    await softDelete(db, 'tasks', input.id)
    return { ok: true }
  },

  async list_events(input, { db }) {
    const from = new Date(String(input.from)).toISOString()
    const to = new Date(String(input.to)).toISOString()
    return run(
      db.select('events', eventCols)
        .is('deleted_at', null)
        .lt('starts_at', to)
        .or(`recurrence.not.is.null,ends_at.gte."${from}",starts_at.gte."${from}"`)
        .order('starts_at')
        .limit(300),
    )
  },
  async create_event(input, { db }) {
    const row = pick(input, ['title', 'starts_at', 'ends_at', 'all_day', 'description', 'location', 'recurrence', 'color'])
    if (!row.ends_at && !row.all_day) row.ends_at = new Date(new Date(String(row.starts_at)).getTime() + 3_600_000).toISOString()
    const saved = await run(db.insert('events', row).select(eventCols).single())
    return saved
  },
  async update_event(input, { db }) {
    const patch = pick(input, ['title', 'starts_at', 'ends_at', 'all_day', 'description', 'location', 'recurrence', 'color'])
    const row = await run(db.update('events', patch).eq('id', input.id).select(eventCols).single())
    return row
  },
  async delete_event(input, { db }) {
    await softDelete(db, 'events', input.id)
    return { ok: true }
  },

  async search_notes(input, { db }) {
    let q = db.select('notes', noteCols).is('deleted_at', null).order('updated_at', { ascending: false }).limit(20)
    const query = typeof input.query === 'string' ? input.query.trim() : ''
    if (query) q = q.textSearch('fts', query, { type: 'websearch', config: 'simple' })
    return run(q)
  },
  async create_note(input, { db }) {
    const row = await run(db.insert('notes', pick(input, ['title', 'body', 'tags', 'pinned'])).select(noteCols).single())
    return row
  },
  async update_note(input, { db }) {
    const row = await run(
      db.update('notes', pick(input, ['title', 'body', 'tags', 'pinned'])).eq('id', input.id).select(noteCols).single(),
    )
    return row
  },
  async delete_note(input, { db }) {
    await softDelete(db, 'notes', input.id)
    return { ok: true }
  },

  async list_milestones(input, { db }) {
    let q = db.select('milestones', milestoneCols).is('deleted_at', null).order('target_date', { nullsFirst: false })
    if (!input.include_achieved) q = q.is('achieved_at', null)
    const milestones = (await run(q)) as { id: string }[]
    if (!milestones.length) return []
    const steps = (await run(
      db.select('tasks', 'id,title,done,due_at,milestone_id')
        .is('deleted_at', null)
        .in('milestone_id', milestones.map((m) => m.id))
        .order('sort_order'),
    )) as { milestone_id: string }[]
    return milestones.map((m) => ({ ...m, steps: steps.filter((s) => s.milestone_id === m.id) }))
  },
  async create_milestone(input, { db }) {
    const row = (await run(
      db.insert('milestones', pick(input, ['title', 'description', 'emoji', 'color', 'target_date'])).select(milestoneCols).single(),
    )) as { id: string; title: string }
    const titles = Array.isArray(input.steps) ? input.steps.map(String).filter(Boolean) : []
    const steps = titles.length ? await insertSteps(db, row, titles.map((title) => ({ title }))) : []
    return { ...row, steps }
  },
  async update_milestone(input, { db }) {
    const patch: Input = pick(input, ['title', 'description', 'emoji', 'color', 'target_date'])
    if (typeof input.achieved === 'boolean') patch.achieved_at = input.achieved ? new Date().toISOString() : null
    const row = (await run(db.update('milestones', patch).eq('id', input.id).select(milestoneCols).single())) as {
      title: string
    }
    return row
  },
  async add_milestone_steps(input, { db }) {
    const milestone = (await run(db.select('milestones', 'id,title').eq('id', input.milestone_id).single())) as {
      id: string
      title: string
    }
    const steps = Array.isArray(input.steps) ? (input.steps as Input[]).filter((s) => s?.title) : []
    const rows = await insertSteps(db, milestone, steps)
    return rows
  },
  async delete_milestone(input, { db }) {
    await softDelete(db, 'milestones', input.id)
    await run(db.update('tasks', { milestone_id: null }).eq('milestone_id', input.id).select('id'))
    return { ok: true }
  },

  async list_transactions(input, { db }) {
    let q = db.select('transactions', txCols).is('deleted_at', null).order('occurred_on', { ascending: false }).limit(300)
    if (input.from) q = q.gte('occurred_on', input.from)
    if (input.to) q = q.lte('occurred_on', input.to)
    if (input.kind) q = q.eq('kind', input.kind)
    if (input.category) q = q.ilike('category', likeExact(String(input.category)))
    return run(q)
  },
  async create_transaction(input, { db }) {
    const row = await run(db.insert('transactions', pick(input, txFields)).select(txCols).single())
    return row
  },
  async update_transaction(input, { db }) {
    const row = await run(db.update('transactions', pick(input, txFields)).eq('id', input.id).select(txCols).single())
    return row
  },
  async delete_transaction(input, { db }) {
    await softDelete(db, 'transactions', input.id)
    return { ok: true }
  },
  async budget_summary(input, { db, today }) {
    const month = /^\d{4}-\d{2}$/.test(String(input.month)) ? String(input.month) : today.slice(0, 7)
    const [y, m] = month.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    const [txs, budgets] = await Promise.all([
      run(
        db.select('transactions', 'kind,amount,category')
          .is('deleted_at', null)
          .gte('occurred_on', `${month}-01`)
          .lt('occurred_on', `${next}-01`),
      ) as Promise<{ kind: string; amount: number | string; category: string }[]>,
      run(db.select('budgets', 'category,monthly_limit').is('deleted_at', null)) as Promise<
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
  async set_budget(input, { db }) {
    const existing = (await run(
      db.select('budgets', 'id,category').is('deleted_at', null).ilike('category', likeExact(String(input.category).trim())).limit(1),
    )) as { id: string; category: string }[]
    const category = existing[0]?.category ?? String(input.category).trim()
    const row = existing.length
      ? await run(db.update('budgets', { monthly_limit: input.monthly_limit }).eq('id', existing[0].id).select().single())
      : await run(db.insert('budgets', { category, monthly_limit: input.monthly_limit }).select().single())
    return row
  },
  async remove_budget(input, { db }) {
    const category = String(input.category).trim()
    const rows = (await run(
      db.update('budgets', { deleted_at: new Date().toISOString() })
        .is('deleted_at', null)
        .ilike('category', likeExact(category))
        .select('id'),
    )) as { id: string }[]
    if (!rows.length) throw new Error(`No limit is set for ${category}`)
    return { ok: true }
  },
}

// Steps are tasks filed in a list named after their milestone, like the app does
function insertSteps(db: Db, milestone: { id: string; title: string }, steps: Input[]) {
  const base = Date.now()
  return run(
    db.insert('tasks', steps.map((s, i) => ({ title: s.title, due_at: s.due_at, list: milestone.title, milestone_id: milestone.id, sort_order: base + i })))
      .select('id,title,done,due_at'),
  )
}

// Case-insensitive equality through ilike, with its wildcards escaped
const likeExact = (s: string) => s.replace(/[\\%_]/g, '\\$&')

// Read-only tools run without a prompt in Claude; deletes are flagged so
// Claude asks first
for (const tool of tools) {
  const readOnly = /^(list_|search_|budget_summary)/.test(tool.name)
  tool.annotations = { readOnlyHint: readOnly, destructiveHint: /^(delete_|remove_)/.test(tool.name) }
}

// ---------------------------------------------------------------- server

function localDate(tz: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function instructions(tz: string) {
  return `This is the user's personal to-do app: Tasks, a Calendar, Notes, Milestones (long-term goals broken into steps) and a Budget for tracking money.
Act on clear requests straight away. Before updating or deleting, look the item up so you use its real id; never invent ids.
The user's time zone is ${tz}. Interpret dates and times there, and always send times with their UTC offset. Amounts have no currency stored; write them the way the user does.`
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

type RpcRequest = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> }

const rpcResult = (id: RpcRequest['id'], result: unknown) => ({ jsonrpc: '2.0', id, result })
const rpcError = (id: RpcRequest['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

async function answer(msg: RpcRequest, ctx: Ctx, tz: string) {
  switch (msg.method) {
    case 'initialize': {
      const asked = String(msg.params?.protocolVersion ?? '')
      return rpcResult(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'my-todo', title: 'My To-do', version: '1.0.0' },
        instructions: instructions(tz),
      })
    }
    case 'ping':
      return rpcResult(msg.id, {})
    case 'tools/list':
      return rpcResult(msg.id, { tools })
    case 'tools/call': {
      const name = String(msg.params?.name ?? '')
      const handler = handlers[name]
      if (!handler) return rpcError(msg.id, -32602, `Unknown tool ${name}`)
      try {
        const out = await handler((msg.params?.arguments ?? {}) as Input, ctx)
        return rpcResult(msg.id, { content: [{ type: 'text', text: JSON.stringify(out) }] })
      } catch (e) {
        // Tool failures go back to Claude as results so it can explain or retry
        const text = e instanceof Error ? e.message : String(e)
        return rpcResult(msg.id, { content: [{ type: 'text', text }], isError: true })
      }
    }
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  // Stateless Streamable HTTP: no server-sent stream and no sessions to end
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { ...cors, Allow: 'POST' } })

  // URL is .../functions/v1/mcp/<token>
  const token = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? ''
  if (token.length < 32) return json(rpcError(null, -32001, 'This connector link is incomplete. Copy it again from the app.'), 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { data: link } = await admin
    .from('connector_tokens')
    .select('id,user_id,timezone,last_used_at')
    .eq('token_hash', await sha256(token))
    .is('revoked_at', null)
    .maybeSingle()
  if (!link) return json(rpcError(null, -32001, 'This connector link was removed. Make a new one in the app.'), 401)

  // Note when the link was last used, at most hourly
  if (!link.last_used_at || Date.now() - Date.parse(link.last_used_at) > 3_600_000) {
    await admin.from('connector_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', link.id)
  }

  const body = await req.json().catch(() => null)
  if (!body) return json(rpcError(null, -32700, 'Parse error'), 400)

  const tz = link.timezone || 'UTC'
  const ctx: Ctx = { db: scoped(admin, link.user_id), today: localDate(tz) }
  const batch: RpcRequest[] = Array.isArray(body) ? body : [body]
  const replies = []
  for (const msg of batch) {
    if (msg?.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      replies.push(rpcError(msg?.id, -32600, 'Invalid request'))
      continue
    }
    const reply = await answer(msg, ctx, tz)
    // Notifications (no id) get no reply
    if (msg.id !== undefined && msg.id !== null) replies.push(reply)
  }
  if (!replies.length) return new Response(null, { status: 202, headers: cors })
  return json(Array.isArray(body) ? replies : replies[0])
})
