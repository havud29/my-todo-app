-- Long-term goals (e.g. "Buy a new laptop") with tasks as their steps
create table if not exists public.milestones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  title        text not null,
  description  text not null default '',
  emoji        text not null default '🎯',
  color        text not null default 'violet',
  target_date  date,
  achieved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists milestones_user_target_idx on public.milestones (user_id, target_date);

select public.setup_owned_table('milestones');

-- A task can be a step towards one milestone
alter table public.tasks add column if not exists milestone_id uuid references public.milestones on delete set null;
create index if not exists tasks_milestone_idx on public.tasks (milestone_id);
