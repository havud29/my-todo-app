import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY, // anon / publishable key, never service_role
  { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } },
)

export const signIn = (provider: 'google' | 'github') =>
  supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
  })

export const signOut = () => supabase.auth.signOut()
