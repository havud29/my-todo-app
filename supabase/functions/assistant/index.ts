// Supabase Edge Function: chat with Claude, who can read and change the
// signed-in user's tasks, events and notes through tools.
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
type Ctx = { db: SupabaseClient; done: Action[] }
// Something Claude changed, shown under its reply
type Action = { kind: 'task' | 'event' | 'note'; verb: 'added' | 'updated' | 'deleted'; title: string }

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
]

const pick = (input: Input, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]))

const taskCols = 'id,title,notes,list,done,due_at,priority'
const eventCols = 'id,title,description,location,starts_at,ends_at,all_day,recurrence,color'
const noteCols = 'id,title,body,tags,pinned,updated_at'

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
}

// ---------------------------------------------------------------- prompt

const instructions = `You are the assistant inside the user's personal to-do app, which has Tasks, a Calendar and Notes.
You can read and change their data with the tools. Act on clear requests straight away instead of asking for confirmation; ask a short question only when a request is genuinely ambiguous (for example, which of two similar tasks to delete).
Before updating or deleting, look the item up so you use its real id. Never invent ids.
Interpret dates and times in the user's time zone, given below, and always send times with their UTC offset.
Reply briefly and warmly in plain sentences, in the language the user writes in. After making changes, say what you did in one or two lines. Use Markdown lists only when listing several items.`

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
  const ctx: Ctx = { db, done: [] }

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
