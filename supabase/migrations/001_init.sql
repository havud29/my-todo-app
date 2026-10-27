-- Every migration here is safe to run again: GitHub Actions applies them with
-- `supabase db push`, including on databases where they were first run by
-- hand in the SQL Editor.

-- shared helper: bump updated_at on every change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  title       text not null default '',
  body        text not null default '',
  tags        text[] not null default '{}',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  fts tsvector generated always as
    (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,''))) stored
);
create index if not exists notes_fts_idx on public.notes using gin (fts);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  title       text not null,
  description text not null default '',
  location    text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  all_day     boolean not null default false,
  recurrence  text,          -- e.g. 'FREQ=WEEKLY;BYDAY=MO,WE'
  remind_min  int,           -- minutes before start, null = no reminder
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists events_user_start_idx on public.events (user_id, starts_at);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  title       text not null,
  notes       text not null default '',
  list        text not null default 'Inbox',
  done        boolean not null default false,
  done_at     timestamptz,
  due_at      timestamptz,
  priority    smallint not null default 0 check (priority between 0 and 3),
  sort_order  double precision not null default 0,
  note_id     uuid references public.notes on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists tasks_user_due_idx on public.tasks (user_id, done, due_at);

-- Owner-only access, the updated_at trigger and live sync for a table.
-- Later migrations reuse this for their own tables.
create or replace function public.setup_owned_table(t text)
returns void language plpgsql as $$
begin
  execute format('drop trigger if exists %I_updated on public.%I', t, t);
  execute format('create trigger %I_updated before update on public.%I
                  for each row execute function public.set_updated_at()', t, t);
  execute format('alter table public.%I enable row level security', t);
  execute format('drop policy if exists "owner only" on public.%I', t);
  execute format('create policy "owner only" on public.%I for all to authenticated
                  using ((select auth.uid()) = user_id)
                  with check ((select auth.uid()) = user_id)', t);
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
  ) then
    execute format('alter publication supabase_realtime add table public.%I', t);
  end if;
end $$;

select public.setup_owned_table(t) from unnest(array['notes', 'events', 'tasks']) as t;
