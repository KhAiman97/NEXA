-- 07 · Fitness & Sports Performance
-- workouts: general daily log (+ workout_sets for strength work).
-- Racket sports: court_bookings + racket_matches + per-game scores.
-- Target sports: shooting_sessions + per-series breakdown.

create table public.workouts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  performed_at      timestamptz not null default now(),
  kind              text not null default 'other'
                      check (kind in (
                        'strength', 'cardio', 'run', 'cycling', 'swim', 'walk',
                        'racket', 'shooting', 'mobility', 'other'
                      )),
  title             text not null,
  duration_min      integer check (duration_min > 0),
  calories_burned   integer check (calories_burned >= 0),
  distance_km       numeric(7, 2) check (distance_km >= 0),
  avg_heart_rate    integer check (avg_heart_rate between 30 and 250),
  perceived_exertion smallint check (perceived_exertion between 1 and 10),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, id)
);

create table public.workout_sets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null,
  exercise   text not null,
  set_no     smallint not null check (set_no > 0),
  reps       integer check (reps >= 0),
  weight_kg  numeric(6, 2) check (weight_kg >= 0),
  duration_s integer check (duration_s >= 0),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_id, exercise, set_no),
  foreign key (user_id, workout_id) references public.workouts (user_id, id) on delete cascade
);

create table public.court_bookings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sport          text not null
                   check (sport in ('badminton', 'tennis', 'squash', 'padel', 'table_tennis', 'pickleball')),
  venue          text not null,
  court_name     text,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  cost           numeric(12, 2) not null default 0 check (cost >= 0),
  status         text not null default 'booked'
                   check (status in ('booked', 'played', 'cancelled', 'no_show')),
  booking_ref    text,
  transaction_id uuid,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, id),
  check (ends_at > starts_at),
  foreign key (user_id, transaction_id) references public.transactions (user_id, id)
    on delete set null (transaction_id)
);

create table public.racket_matches (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sport            text not null
                     check (sport in ('badminton', 'tennis', 'squash', 'padel', 'table_tennis', 'pickleball')),
  played_at        timestamptz not null default now(),
  match_type       text not null default 'singles' check (match_type in ('singles', 'doubles')),
  opponent         text,
  partner          text,
  venue            text,
  court_booking_id uuid,
  workout_id       uuid,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, court_booking_id) references public.court_bookings (user_id, id)
    on delete set null (court_booking_id),
  foreign key (user_id, workout_id) references public.workouts (user_id, id)
    on delete set null (workout_id)
);

create table public.racket_match_games (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  match_id       uuid not null,
  game_no        smallint not null check (game_no > 0),
  my_score       smallint not null check (my_score >= 0),
  opponent_score smallint not null check (opponent_score >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (match_id, game_no),
  foreign key (user_id, match_id) references public.racket_matches (user_id, id) on delete cascade
);

create table public.shooting_sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_at         timestamptz not null default now(),
  discipline         text not null default 'other'
                       check (discipline in ('air_rifle', 'air_pistol', 'rifle', 'pistol', 'archery', 'other')),
  venue              text,
  distance_m         numeric(6, 1) check (distance_m > 0),
  equipment          text,
  ammo_type          text,
  total_shots        integer not null default 0 check (total_shots >= 0),
  shots_on_target    integer not null default 0 check (shots_on_target >= 0),
  total_score        numeric(7, 1) check (total_score >= 0),
  max_score          numeric(7, 1) check (max_score > 0),
  avg_group_size_mm  numeric(6, 1) check (avg_group_size_mm >= 0),
  ammo_cost          numeric(12, 2) not null default 0 check (ammo_cost >= 0),
  transaction_id     uuid,
  notes              text,
  accuracy_pct       numeric(5, 2) generated always as (
                       round(100.0 * shots_on_target / nullif(total_shots, 0), 2)
                     ) stored,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, id),
  check (shots_on_target <= total_shots),
  check (total_score is null or max_score is null or total_score <= max_score),
  foreign key (user_id, transaction_id) references public.transactions (user_id, id)
    on delete set null (transaction_id)
);

create table public.shooting_series (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id    uuid not null,
  series_no     smallint not null check (series_no > 0),
  shots         integer not null check (shots > 0),
  hits          integer not null default 0 check (hits >= 0),
  score         numeric(7, 1) check (score >= 0),
  max_score     numeric(7, 1) check (max_score > 0),
  group_size_mm numeric(6, 1) check (group_size_mm >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (session_id, series_no),
  check (hits <= shots),
  foreign key (user_id, session_id) references public.shooting_sessions (user_id, id) on delete cascade
);

create index on public.workouts (user_id, performed_at desc);
create index on public.workout_sets (user_id, workout_id);
create index on public.court_bookings (user_id, starts_at desc);
create index on public.racket_matches (user_id, played_at desc);
create index on public.racket_matches (user_id, court_booking_id) where court_booking_id is not null;
create index on public.racket_matches (user_id, workout_id) where workout_id is not null;
create index on public.racket_match_games (user_id, match_id);
create index on public.shooting_sessions (user_id, session_at desc);
create index on public.shooting_series (user_id, session_id);

alter table public.workouts enable row level security;
create policy "Users see own data" on public.workouts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.workout_sets enable row level security;
create policy "Users see own data" on public.workout_sets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.court_bookings enable row level security;
create policy "Users see own data" on public.court_bookings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.racket_matches enable row level security;
create policy "Users see own data" on public.racket_matches for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.racket_match_games enable row level security;
create policy "Users see own data" on public.racket_match_games for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.shooting_sessions enable row level security;
create policy "Users see own data" on public.shooting_sessions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.shooting_series enable row level security;
create policy "Users see own data" on public.shooting_series for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- views

-- A match is won by taking more games than the opponent (a game = higher score).
create view public.racket_match_results with (security_invoker = true) as
select
  m.id as match_id,
  m.user_id,
  m.sport,
  m.played_at,
  m.match_type,
  m.opponent,
  count(g.id) filter (where g.my_score > g.opponent_score) as games_won,
  count(g.id) filter (where g.my_score < g.opponent_score) as games_lost,
  case
    when count(g.id) = 0 then null
    when count(g.id) filter (where g.my_score > g.opponent_score)
       > count(g.id) filter (where g.my_score < g.opponent_score) then 'win'
    when count(g.id) filter (where g.my_score < g.opponent_score)
       > count(g.id) filter (where g.my_score > g.opponent_score) then 'loss'
    else 'draw'
  end as result,
  coalesce(sum(g.my_score), 0)       as points_for,
  coalesce(sum(g.opponent_score), 0) as points_against
from public.racket_matches m
left join public.racket_match_games g on g.match_id = m.id
group by m.id, m.user_id, m.sport, m.played_at, m.match_type, m.opponent;
