import { supabase } from '../../lib/supabase'
import type { ConnectorLink } from './types'

const columns = 'id,label,created_at,last_used_at'

export async function listLinks(): Promise<ConnectorLink[]> {
  const { data, error } = await supabase
    .from('connector_tokens')
    .select(columns)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Makes a new private link for the MCP connector. Only the token's hash is
// saved, so the returned URL can't be shown again later.
export async function createLink(): Promise<{ link: ConnectorLink; url: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const { data, error } = await supabase
    .from('connector_tokens')
    .insert({ token_hash: await sha256(token), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
    .select(columns)
    .single()
  if (error) throw error
  return { link: data, url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp/${token}` }
}

export async function revokeLink(id: string): Promise<void> {
  const { error } = await supabase.from('connector_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
