-- 11 · One round trip per page
-- Each page used to send 5 to 12 Data API requests, some of them one after another (session, then
-- profile, then the page's queries, then per-vehicle detail). Every function below returns everything one
-- page needs as a single jsonb document, with the same rows the separate requests returned.
-- All are security invoker: RLS still decides which rows the caller sees, and none takes a user id.
-- Lists are built from an ordered subquery, so the array keeps that order.

-- Search on transaction titles (ilike '%text%') needs a trigram index to avoid a full scan.
create extension if not exists pg_trgm with schema extensions;

create index if not exists transactions_title_trgm_idx
  on public.transactions using gin (title extensions.gin_trgm_ops);

-- Filtered ledger pages: each filter column followed by the paging order.
create index if not exists transactions_user_id_type_occurred_at_idx
  on public.transactions (user_id, type, occurred_at desc);
create index if not exists transactions_user_id_category_id_occurred_at_idx
  on public.transactions (user_id, category_id, occurred_at desc);
create index if not exists transactions_user_id_account_id_occurred_at_idx
  on public.transactions (user_id, account_id, occurred_at desc);
drop index if exists public.transactions_user_id_category_id_idx;
drop index if exists public.transactions_user_id_account_id_idx;

-- "Today's logs" and "this week's rows" read by time alone, not by goal or vehicle.
create index if not exists exercise_logs_user_id_logged_at_idx
  on public.exercise_logs (user_id, logged_at desc);
create index if not exists court_bookings_user_id_status_starts_at_idx
  on public.court_bookings (user_id, status, starts_at desc);
create index if not exists maintenance_logs_vehicle_kind_latest_idx
  on public.maintenance_logs (user_id, vehicle_id, kind, performed_on desc, created_at desc);

-- ---------------------------------------------------------------------------------------------------
-- Session: who is signed in plus their display settings. The Data API verifies the token's signature
-- before this runs, so the id comes from a verified token without a separate call to the auth server.
create or replace function public.app_session()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', (select auth.uid()),
    'email', (select auth.jwt()) ->> 'email',
    'profile', (
      select jsonb_build_object('display_name', p.display_name, 'currency', p.currency, 'timezone', p.timezone)
      from public.profiles p
      where p.id = (select auth.uid())
    )
  );
$$;

-- ---------------------------------------------------------------------------------------------------
-- Ledger page with filters applied in the database. Replaces the two-argument version from migration 10.
drop function if exists public.transactions_page(integer, integer);

create or replace function public.transactions_page(
  p_limit       integer     default 10,
  p_offset      integer     default 0,
  p_type        text        default null,
  p_category_id uuid        default null,
  p_account_id  uuid        default null,
  p_search      text        default null,
  p_from        timestamptz default null,
  p_to          timestamptz default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with matched as (
    select t.*
    from public.transactions t
    where (p_type is null or t.type = p_type)
      and (p_category_id is null or t.category_id = p_category_id)
      and (p_account_id is null or t.account_id = p_account_id)
      and (p_from is null or t.occurred_at >= p_from)
      and (p_to is null or t.occurred_at < p_to)
      and (nullif(btrim(p_search), '') is null
           or t.title ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from matched),
    'income', (select coalesce(sum(m.amount), 0) from matched m where m.type = 'income'),
    'expense', (select coalesce(sum(m.amount), 0) from matched m where m.type = 'expense'),
    'rows', coalesce(
      (
        select jsonb_agg(to_jsonb(page))
        from (
          select m.*
          from matched m
          order by m.occurred_at desc, m.id desc
          limit least(greatest(coalesce(p_limit, 10), 1), 100)
          offset greatest(coalesce(p_offset, 0), 0)
        ) page
      ),
      '[]'::jsonb
    )
  );
$$;

-- ---------------------------------------------------------------------------------------------------
-- One local day of food and drink: totals, goal and the raw entries. Shared by Overview and Nutrition.
create or replace function public.nutrition_day(p_day date, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'nutrition', (select to_jsonb(n) from public.daily_nutrition n where n.day = p_day limit 1),
    'hydration', (select to_jsonb(h) from public.daily_hydration h where h.day = p_day limit 1),
    'goal', (select to_jsonb(g) from public.nutrition_goals g limit 1),
    'food_logs', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.food_logs where logged_at >= p_from and logged_at < p_to order by logged_at desc limit 500) x), '[]'::jsonb),
    'drinks', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.hydration_logs where logged_at >= p_from and logged_at < p_to order by logged_at desc limit 500) x), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------------------------------
-- Overview page.
create or replace function public.dashboard_bundle(
  p_month      date,
  p_today      date,
  p_day_from   timestamptz,
  p_day_to     timestamptz,
  p_week_start timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'overview', (select to_jsonb(o) from public.finance_overview(p_month) o),
    'active_subscriptions', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.subscriptions where is_active order by name limit 500) x), '[]'::jsonb),
    'running_costs', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.vehicle_running_costs order by name limit 100) x), '[]'::jsonb),
    'project_costs', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.project_cost_summary order by name limit 100) x), '[]'::jsonb),
    'low_stock', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.inventory_items
        where status not in ('sold', 'broken') and reorder_level > 0 and quantity <= reorder_level
        order by name limit 500) x), '[]'::jsonb),
    'day', public.nutrition_day(p_today, p_day_from, p_day_to),
    'recent_workouts', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.workouts where performed_at >= p_week_start order by performed_at desc limit 100) x), '[]'::jsonb),
    'upcoming_bookings', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.court_bookings where status = 'booked' and starts_at >= p_day_from order by starts_at desc limit 20) x), '[]'::jsonb),
    'exercise_goals', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.exercise_goals where is_active order by created_at limit 100) x), '[]'::jsonb),
    'exercise_today', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.daily_exercise where day = p_today) x), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------------------------------
-- Finance page, including the filtered ledger page.
create or replace function public.finance_bundle(
  p_month       date,
  p_limit       integer     default 10,
  p_offset      integer     default 0,
  p_type        text        default null,
  p_category_id uuid        default null,
  p_account_id  uuid        default null,
  p_search      text        default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'overview', (select to_jsonb(o) from public.finance_overview(p_month) o),
    'cashflow', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.monthly_cashflow order by month desc limit 6) x), '[]'::jsonb),
    'ledger', public.transactions_page(p_limit, p_offset, p_type, p_category_id, p_account_id, p_search),
    'categories', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.categories order by name limit 500) x), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.finance_accounts order by name limit 500) x), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.subscriptions order by name limit 500) x), '[]'::jsonb),
    'liabilities', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.liabilities order by name limit 500) x), '[]'::jsonb),
    'balances', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.liability_balances order by name limit 100) x), '[]'::jsonb),
    'asset_values', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.asset_latest_values order by name limit 100) x), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.assets order by name limit 500) x), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.goals order by name limit 500) x), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------------------------------
-- Vehicles page. Also replaces the per-vehicle follow-up requests: the latest 12 fuel segments of every
-- vehicle, and the latest service of each kind per vehicle (what the reminders are worked out from).
create or replace function public.vehicles_bundle()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'vehicles', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.vehicles order by name limit 100) x), '[]'::jsonb),
    'costs', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.vehicle_running_costs order by name limit 100) x), '[]'::jsonb),
    'fuel', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.fuel_logs order by filled_at desc limit 15) x), '[]'::jsonb),
    'maintenance', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.maintenance_logs order by performed_on desc limit 15) x), '[]'::jsonb),
    'parking', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.parking_logs order by started_at desc limit 15) x), '[]'::jsonb),
    'segments', coalesce((select jsonb_agg(to_jsonb(x) - 'rn') from (
        select * from (
          select s.*, row_number() over (partition by s.vehicle_id order by s.ended_at desc) as rn
          from public.vehicle_fuel_segments s
        ) ranked
        where ranked.rn <= 12
        order by ranked.vehicle_id, ranked.ended_at desc) x), '[]'::jsonb),
    'latest_services', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select distinct on (m.vehicle_id, m.kind) m.*
        from public.maintenance_logs m
        order by m.vehicle_id, m.kind, m.performed_on desc, m.created_at desc) x), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------------------------------
-- Projects page.
create or replace function public.projects_bundle()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'projects', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.projects order by created_at desc limit 200) x), '[]'::jsonb),
    'costs', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.project_cost_summary order by name limit 100) x), '[]'::jsonb),
    'inventory', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.inventory_items order by name limit 500) x), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------------------------------
-- Nutrition page.
create or replace function public.nutrition_bundle(p_day date, p_from timestamptz, p_to timestamptz, p_trend_from date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'day', public.nutrition_day(p_day, p_from, p_to),
    'trend', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.daily_hydration where day >= p_trend_from and day <= p_day order by day) x), '[]'::jsonb),
    'foods', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.foods order by name limit 200) x), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------------------------------
-- Fitness page.
create or replace function public.fitness_bundle(p_today date, p_from timestamptz, p_to timestamptz, p_daily_from date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'workouts', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.workouts order by performed_at desc limit 15) x), '[]'::jsonb),
    'match_results', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.racket_match_results order by played_at desc limit 500) x), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.court_bookings order by starts_at desc limit 10) x), '[]'::jsonb),
    'shooting_sessions', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.shooting_sessions order by session_at desc limit 60) x), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.racket_matches order by played_at desc limit 10) x), '[]'::jsonb),
    'exercise_goals', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.exercise_goals order by created_at limit 100) x), '[]'::jsonb),
    'daily_exercise', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.daily_exercise where day >= p_daily_from and day <= p_today) x), '[]'::jsonb),
    'today_logs', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.exercise_logs where logged_at >= p_from and logged_at < p_to order by logged_at desc limit 200) x), '[]'::jsonb)
  );
$$;

-- Functions are executable by everyone by default: signed-in users only.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.app_session()',
    'public.transactions_page(integer, integer, text, uuid, uuid, text, timestamptz, timestamptz)',
    'public.nutrition_day(date, timestamptz, timestamptz)',
    'public.dashboard_bundle(date, date, timestamptz, timestamptz, timestamptz)',
    'public.finance_bundle(date, integer, integer, text, uuid, uuid, text)',
    'public.vehicles_bundle()',
    'public.projects_bundle()',
    'public.nutrition_bundle(date, timestamptz, timestamptz, date)',
    'public.fitness_bundle(date, timestamptz, timestamptz, date)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
