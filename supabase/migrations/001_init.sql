-- shared helper: bump updated_at on every change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table public.notes (
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
create index notes_fts_idx on public.notes using gin (fts);
create index notes_user_updated_idx on public.notes (user_id, updated_at);

create table public.events (
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
create index events_user_start_idx on public.events (user_id, starts_at);

create table public.tasks (
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
create index tasks_user_due_idx on public.tasks (user_id, done, due_at);

-- triggers + row-level security on all three tables
do $$
declare t text;
begin
  foreach t in array array['notes','events','tasks'] loop
    execute format('create trigger %I_updated before update on public.%I
                    for each row execute function public.set_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner only" on public.%I for all to authenticated
                    using ((select auth.uid()) = user_id)
                    with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- live sync between devices
alter publication supabase_realtime add table public.notes, public.events, public.tasks;
