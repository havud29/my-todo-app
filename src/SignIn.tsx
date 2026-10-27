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
      <div className="signin-card">
        <span className="logo" aria-hidden>
          ✦
        </span>
        <h1>My To-do App</h1>
        <p>Plan your work on a calendar, keep tasks and notes in one place.</p>
        <button onClick={() => go('google')}>Continue with Google</button>
        <button onClick={() => go('github')}>Continue with GitHub</button>
        {error && <p className="error">{error}</p>}
      </div>
    </main>
  )
}
