-- Long-term goals (e.g. "Buy a new laptop") with tasks as their steps
create table public.milestones (
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
create index milestones_user_target_idx on public.milestones (user_id, target_date);

create trigger milestones_updated before update on public.milestones
  for each row execute function public.set_updated_at();
alter table public.milestones enable row level security;
create policy "owner only" on public.milestones for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- A task can be a step towards one milestone
alter table public.tasks add column milestone_id uuid references public.milestones on delete set null;
create index tasks_milestone_idx on public.tasks (milestone_id);

alter publication supabase_realtime add table public.milestones;
