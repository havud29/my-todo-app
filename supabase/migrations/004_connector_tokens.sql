-- Private links that let Claude (as a custom connector) reach one user's data.
-- Only a SHA-256 hash of each token is kept; the link is shown once.
create table public.connector_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  token_hash    text not null unique,
  label         text not null default 'Claude',
  timezone      text not null default 'UTC',
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);
create index connector_tokens_user_idx on public.connector_tokens (user_id);

alter table public.connector_tokens enable row level security;
create policy "owner only" on public.connector_tokens for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
