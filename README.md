# My To-do App

Personal notes, calendar and tasks, which you can also manage by chatting with Claude. A Vite + React + TypeScript app hosted on GitHub Pages, with Supabase for sign-in (Google, GitHub) and data.

## Local development

```sh
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm install
npm run dev                  # http://localhost:5173/my-todo-app/
```

## One-time setup (Phase 1)

1. **Supabase:** create a project. The database tables come from `supabase/migrations/`; let GitHub apply them (see *Automatic database migrations* below), or run each file in order in the SQL Editor. Every migration is safe to run again.
2. **GitHub OAuth app:** Settings → Developer settings → OAuth Apps → New. Homepage `https://havud29.github.io/my-todo-app/`, callback `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the Client ID and Secret into Supabase → Authentication → Sign In / Providers → GitHub.
3. **Google OAuth client:** in Google Cloud Console, set the consent screen to External / Testing with yourself as test user. Create a Web OAuth client with JavaScript origins `https://havud29.github.io` and `http://localhost:5173`, and the Supabase callback above as redirect URI. Paste the ID and Secret into Supabase → Providers → Google.
4. **Supabase URL settings** (Authentication → URL Configuration): Site URL `https://havud29.github.io/my-todo-app/`, plus redirect URL `http://localhost:5173/**`.
5. **This repo:** Settings → Pages → Source: GitHub Actions. Settings → Secrets and variables → Actions → Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` (anon key only). You can skip these once `SUPABASE_PROJECT_REF` and the `SUPABASE_ACCESS_TOKEN` secret are set (see below): the deploy then looks both up itself.
6. Sign in once with each provider, check they map to one user, then turn off "Allow new users to sign up".

## Use with Claude

Claude can read and change your tasks, events, notes, milestones and budget from a normal Claude chat (claude.ai, desktop or phone). The app is a **custom connector** for Claude: a remote MCP server in the Supabase Edge Function `supabase/functions/mcp/`. It runs on your own Claude plan, Pro included, with no API key or extra cost.

One-time setup:

1. **Database:** `supabase/migrations/004_connector_tokens.sql` must be applied (automatic once migrations are set up below).
2. **Deploy the function** with JWT verification off (Claude doesn't send a Supabase session; the private link is checked instead). Either way:
   - *Automatically:* create a token at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens). In this repo, add it under Settings → Secrets and variables → Actions → Secrets as `SUPABASE_ACCESS_TOKEN`, and add a Variable `SUPABASE_PROJECT_REF` with your project ref (the `<project-ref>` in your Supabase URL). Then run the "Deploy Supabase functions" workflow once from the Actions tab; it redeploys whenever the function changes.
   - *By hand:* Edge Functions → Deploy a new function → Via editor, name it `mcp`, paste `supabase/functions/mcp/index.ts`, turn off "Verify JWT", and deploy.
3. **Connect Claude:** in the app, open the **Claude** button → *Make link*. In Claude, go to Settings → Connectors → *Add custom connector*, name it *My To-do* and paste the link.

If Claude says it "couldn't register with the sign-in service" or asks for an OAuth Client ID, the function is answering 401: turn off JWT verification for `mcp` (Edge Functions → mcp → Details) and add the connector again. No Client ID is needed. Opening the link in a browser should say the connector is running.

The link ends in a private token; only its hash is stored. Anyone with the link can use your data, so keep it private, and remove it from the Claude panel if it leaks. The function uses the `service_role` key that Supabase provides to Edge Functions, and limits every query to the link's owner.

Never commit the `service_role` key or the database password.

## Budget

`supabase/migrations/003_budget.sql` adds `transactions` (money in and out) and `budgets` (a monthly limit per spending category), both private to their owner and synced live. Amounts accept shorthand like `45k` or `1.5m`, and the currency is picked on the Budget page (remembered per device).

## Automatic database migrations

The "Apply database migrations" workflow runs `supabase db push` whenever a change to `supabase/migrations/` reaches `main`, and can be run by hand from the Actions tab. It needs, under Settings → Secrets and variables → Actions:

- Secret `SUPABASE_ACCESS_TOKEN`: a token from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) (shared with the functions workflow).
- Secret `SUPABASE_DB_PASSWORD`: the database password from Supabase → Project Settings → Database (reset it there if you don't have it).
- Variable `SUPABASE_PROJECT_REF`: the `<project-ref>` in your Supabase URL.

Every migration is written to be safe to run again (`if not exists`, policies and triggers dropped and recreated), so the first run also works on a database where some were already run by hand. New migrations go in a new file with the next number, e.g. `005_something.sql`, and should follow the same pattern; `public.setup_owned_table('name')` adds the owner-only policy, `updated_at` trigger and live sync for a new table.
