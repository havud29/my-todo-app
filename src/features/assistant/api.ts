import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { AssistantReply, ChatMessage } from './types'

// Sends the chat to the "assistant" Edge Function, which holds the Anthropic
// key and runs Claude's tool calls with the signed-in user's permissions.
export async function askAssistant(messages: ChatMessage[]): Promise<AssistantReply> {
  const { data, error } = await supabase.functions.invoke<AssistantReply>('assistant', {
    body: {
      messages: messages.map(({ role, content }) => ({ role, content })),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      now: localNow(),
    },
  })
  if (error) throw new Error(await describe(error))
  return data ?? { reply: '', actions: [] }
}

// e.g. "Tuesday 2026-10-27 10:49 (UTC+07:00)"
function localNow() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const day = d.toLocaleDateString('en-US', { weekday: 'long' })
  return `${day} ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} (UTC${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)})`
}

async function describe(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null)
    if (body?.error === 'missing_key') return 'Claude is not set up yet: add the ANTHROPIC_API_KEY secret in Supabase.'
    if (body?.message) return body.message as string
    if (error.context.status === 404) return 'The assistant function is not deployed yet.'
  }
  return error instanceof Error ? error.message : 'Could not reach Claude'
}
