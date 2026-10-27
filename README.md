# My To-do App

Personal notes, calendar and tasks, with a built-in Claude assistant. A Vite + React + TypeScript app hosted on GitHub Pages, with Supabase for sign-in (Google, GitHub) and data.

## Local development

```sh
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm install
npm run dev                  # http://localhost:5173/my-todo-app/
```

## One-time setup (Phase 1)

1. **Supabase:** create a project, then run `supabase/migrations/001_init.sql` in the SQL Editor.
2. **GitHub OAuth app:** Settings → Developer settings → OAuth Apps → New. Homepage `https://havud29.github.io/my-todo-app/`, callback `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the Client ID and Secret into Supabase → Authentication → Sign In / Providers → GitHub.
3. **Google OAuth client:** in Google Cloud Console, set the consent screen to External / Testing with yourself as test user. Create a Web OAuth client with JavaScript origins `https://havud29.github.io` and `http://localhost:5173`, and the Supabase callback above as redirect URI. Paste the ID and Secret into Supabase → Providers → Google.
4. **Supabase URL settings** (Authentication → URL Configuration): Site URL `https://havud29.github.io/my-todo-app/`, plus redirect URL `http://localhost:5173/**`.
5. **This repo:** Settings → Pages → Source: GitHub Actions. Settings → Secrets and variables → Actions → Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` (anon key only).
6. Sign in once with each provider, check they map to one user, then turn off "Allow new users to sign up".

## Claude assistant

The "Ask Claude" button opens a chat where Claude can read and change your tasks, events, notes, milestones and budget. It calls the Anthropic API from the Supabase Edge Function in `supabase/functions/assistant/`, so the API key never reaches the browser. Claude acts with your own sign-in, so row-level security keeps it to your data. It uses Claude Opus 5.5 at low effort; a typical message costs a few US cents, more when Claude makes several changes at once.

A claude.ai subscription can't be used here: the API is billed separately, pay as you go.

1. **API key:** at [console.anthropic.com](https://console.anthropic.com/settings/keys) create a key and add some credit (Settings → Billing). Setting a monthly spend limit there is a good idea.
2. **Store it in Supabase:** Project → Edge Functions → Secrets → add `ANTHROPIC_API_KEY` with the key.
3. **Deploy the function**, either way:
   - *Automatically:* create a token at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens). In this repo, add it under Settings → Secrets and variables → Actions → Secrets as `SUPABASE_ACCESS_TOKEN`, and add a Variable `SUPABASE_PROJECT_REF` with your project ref (the `<project-ref>` in your Supabase URL). Then run the "Deploy Supabase functions" workflow once from the Actions tab; it redeploys whenever the function changes.
   - *By hand:* Edge Functions → Deploy a new function → Via editor, name it `assistant`, paste `supabase/functions/assistant/index.ts`, and deploy.

Chat history stays in the browser tab only; nothing is stored in the database.

Never commit the `service_role` key, the database password or the Anthropic API key.
