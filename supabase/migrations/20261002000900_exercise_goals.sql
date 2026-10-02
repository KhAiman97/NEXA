-- 09 · Daily exercise goals
-- A goal is "do this much of one exercise every day" (20 push-ups, a 60 second plank).
-- exercise_logs holds what was actually done; a day's progress is the sum of its logs.

create table public.exercise_goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  daily_target integer not null check (daily_target > 0),
  unit         text not null default 'reps' check (unit in ('reps', 'seconds', 'minutes')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, name)
);

create table public.exercise_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id    uuid not null,
  logged_at  timestamptz not null default now(),
  amount     integer not null check (amount > 0),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, goal_id) references public.exercise_goals (user_id, id) on delete cascade
);

create index on public.exercise_logs (user_id, goal_id, logged_at desc);

alter table public.exercise_goals enable row level security;
create policy "Users see own data" on public.exercise_goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.exercise_logs enable row level security;
create policy "Users see own data" on public.exercise_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- "Day" is the user's local day. Accounts without a profile fall back to the app default timezone.
create view public.daily_exercise with (security_invoker = true) as
select
  l.user_id,
  l.goal_id,
  (l.logged_at at time zone coalesce(p.timezone, 'Asia/Kuala_Lumpur'))::date as day,
  sum(l.amount)::int as total,
  count(*)::int      as entries
from public.exercise_logs l
left join public.profiles p on p.id = l.user_id
group by l.user_id, l.goal_id, 3;

-- Migration 08 attached updated_at triggers to the tables that existed then; these two are new.
create trigger set_updated_at before update on public.exercise_goals
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.exercise_logs
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.exercise_goals, public.exercise_logs to authenticated;
grant select on public.daily_exercise to authenticated;
