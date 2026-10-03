-- 15 · Drinks carry their calories
-- A drink from the drink menu (teh tarik, Milo ais) is logged as a drink, so it counts toward fluid and
-- caffeine, and its calories are kept on the drink itself instead of a second entry among the meals.
-- daily_hydration gains total_calories (appended, so existing columns keep their order).

alter table public.hydration_logs
  add column if not exists calories numeric(8, 2) not null default 0 check (calories >= 0);

create or replace view public.daily_hydration with (security_invoker = true) as
select
  h.user_id,
  (h.logged_at at time zone p.timezone)::date as day,
  sum(h.volume_ml)    as total_volume_ml,
  sum(h.caffeine_mg)  as total_caffeine_mg,
  count(*)            as drinks,
  sum(h.calories)     as total_calories
from public.hydration_logs h
join public.profiles p on p.id = h.user_id
group by h.user_id, 2;
