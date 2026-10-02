-- 06 · Nutrition & Hydration
-- food_logs snapshot their macros, so editing a food in the library never rewrites history.
-- hydration_logs is the telemetry table: one row per drink, with volume and caffeine.

create table public.foods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  brand        text,
  serving_size numeric(8, 2) not null default 100 check (serving_size > 0),
  serving_unit text not null default 'g',
  calories     numeric(8, 2) not null default 0 check (calories >= 0),
  protein_g    numeric(8, 2) not null default 0 check (protein_g >= 0),
  carbs_g      numeric(8, 2) not null default 0 check (carbs_g >= 0),
  fat_g        numeric(8, 2) not null default 0 check (fat_g >= 0),
  fiber_g      numeric(8, 2) check (fiber_g >= 0),
  sugar_g      numeric(8, 2) check (sugar_g >= 0),
  sodium_mg    numeric(8, 2) check (sodium_mg >= 0),
  is_favorite  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, id)
);

create table public.food_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  meal_type text not null default 'snack'
              check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id   uuid,
  name      text not null,
  servings  numeric(8, 2) not null default 1 check (servings > 0),
  calories  numeric(8, 2) not null default 0 check (calories >= 0),   -- totals for all servings
  protein_g numeric(8, 2) not null default 0 check (protein_g >= 0),
  carbs_g   numeric(8, 2) not null default 0 check (carbs_g >= 0),
  fat_g     numeric(8, 2) not null default 0 check (fat_g >= 0),
  note      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, food_id) references public.foods (user_id, id) on delete set null (food_id)
);

-- One row per user.
create table public.nutrition_goals (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  calories          integer check (calories > 0),
  protein_g         integer check (protein_g >= 0),
  carbs_g           integer check (carbs_g >= 0),
  fat_g             integer check (fat_g >= 0),
  water_ml          integer not null default 2500 check (water_ml > 0),
  caffeine_limit_mg integer not null default 400 check (caffeine_limit_mg >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.hydration_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_at   timestamptz not null default now(),
  beverage    text not null default 'water',
  volume_ml   integer not null check (volume_ml between 1 and 5000),
  caffeine_mg numeric(7, 2) not null default 0 check (caffeine_mg >= 0),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on public.foods (user_id, name);
create index on public.food_logs (user_id, logged_at desc);
create index on public.food_logs (user_id, food_id) where food_id is not null;
create index on public.hydration_logs (user_id, logged_at desc);

alter table public.foods enable row level security;
create policy "Users see own data" on public.foods for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.food_logs enable row level security;
create policy "Users see own data" on public.food_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.nutrition_goals enable row level security;
create policy "Users see own data" on public.nutrition_goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.hydration_logs enable row level security;
create policy "Users see own data" on public.hydration_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- views
-- "Day" is the user's local day (profiles.timezone), not UTC.

create view public.daily_nutrition with (security_invoker = true) as
select
  f.user_id,
  (f.logged_at at time zone p.timezone)::date as day,
  sum(f.calories)  as calories,
  sum(f.protein_g) as protein_g,
  sum(f.carbs_g)   as carbs_g,
  sum(f.fat_g)     as fat_g,
  count(*)         as entries
from public.food_logs f
join public.profiles p on p.id = f.user_id
group by f.user_id, 2;

create view public.daily_hydration with (security_invoker = true) as
select
  h.user_id,
  (h.logged_at at time zone p.timezone)::date as day,
  sum(h.volume_ml)    as total_volume_ml,
  sum(h.caffeine_mg)  as total_caffeine_mg,
  count(*)            as drinks
from public.hydration_logs h
join public.profiles p on p.id = h.user_id
group by h.user_id, 2;
