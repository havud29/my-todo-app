# My To-do App

Personal notes, calendar and tasks. A Vite + React + TypeScript app hosted on GitHub Pages, with Supabase for sign-in (Google, GitHub) and data.

## Local development

```sh
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm install
npm run dev                  # http://localhost:5173/my-todo-app/
```

## One-time setup (Phase 1)

1. **Supabase:** create a project, then run each file in `supabase/migrations/` in order (`001_init.sql`, then `002_milestones.sql`, …) in the SQL Editor.
2. **GitHub OAuth app:** Settings → Developer settings → OAuth Apps → New. Homepage `https://havud29.github.io/my-todo-app/`, callback `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the Client ID and Secret into Supabase → Authentication → Sign In / Providers → GitHub.
3. **Google OAuth client:** in Google Cloud Console, set the consent screen to External / Testing with yourself as test user. Create a Web OAuth client with JavaScript origins `https://havud29.github.io` and `http://localhost:5173`, and the Supabase callback above as redirect URI. Paste the ID and Secret into Supabase → Providers → Google.
4. **Supabase URL settings** (Authentication → URL Configuration): Site URL `https://havud29.github.io/my-todo-app/`, plus redirect URL `http://localhost:5173/**`.
5. **This repo:** Settings → Pages → Source: GitHub Actions. Settings → Secrets and variables → Actions → Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` (anon key only).
6. Sign in once with each provider, check they map to one user, then turn off "Allow new users to sign up".

Never commit the `service_role` key or the database password.
