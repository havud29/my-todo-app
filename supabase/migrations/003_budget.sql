-- Budget: money in and out, plus a monthly spending limit per category

create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  kind         text not null default 'expense' check (kind in ('expense', 'income')),
  amount       numeric(14,2) not null check (amount > 0),
  category     text not null default 'Other',
  note         text not null default '',
  occurred_on  date not null default current_date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, occurred_on);

create table if not exists public.budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  category       text not null,
  monthly_limit  numeric(14,2) not null check (monthly_limit > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
-- one live limit per category
create unique index if not exists budgets_user_category_idx on public.budgets (user_id, lower(category)) where deleted_at is null;

select public.setup_owned_table(t) from unnest(array['transactions', 'budgets']) as t;
