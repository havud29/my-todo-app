import { useState } from 'react'
import { signIn } from './lib/supabase'

export default function SignIn() {
  const [error, setError] = useState<string | null>(null)

  const go = async (provider: 'google' | 'github') => {
    setError(null)
    const { error } = await signIn(provider)
    if (error) setError(error.message)
  }

  return (
    <main className="signin">
      <h1>My To-do App</h1>
      <p>Notes, calendar and tasks in one place.</p>
      <button onClick={() => go('google')}>Sign in with Google</button>
      <button onClick={() => go('github')}>Sign in with GitHub</button>
      {error && <p className="error">{error}</p>}
    </main>
  )
}
