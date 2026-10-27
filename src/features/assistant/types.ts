// A row of public.connector_tokens; the token itself is never stored
export interface ConnectorLink {
  id: string
  label: string
  created_at: string
  last_used_at: string | null
}
