-- 13 · Paid this month, and longer lists
-- 1. A subscription or debt can be marked as paid by hand. The Finance page needs to know which ones
--    already have a payment this month (to show a tick instead of the button), and the daily job must
--    not record the same month again.
-- 2. Lists are paged ten at a time in the app, so the Vehicles and Fitness functions return the latest
--    100 entries instead of 10 to 15: the earlier pages are now reachable.

-- The daily job, with one change from migration 12: a subscription billed monthly or less often is
-- skipped when a charge linked to it already exists in the same calendar month as its bill date
-- (weekly ones are still checked by exact date). The bill date moves on either way.
create or replace function public.post_due_recurring(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r             record;
  v_today       date;
  v_due         date;
  v_month_start date;
  v_guard       integer;
  v_amount      numeric(14, 2);
  v_tx          uuid;
  v_charges     integer := 0;
  v_payments    integer := 0;
begin
  -- Subscriptions --------------------------------------------------------------------------------
  for r in
    select s.id, s.user_id, s.name, s.amount, s.currency, s.billing_cycle, s.next_billing_on, s.account_id, s.category_id,
           coalesce(p.timezone, 'Asia/Kuala_Lumpur') as tz,
           coalesce(p.currency, 'MYR')               as home_currency
    from public.subscriptions s
    left join public.profiles p on p.id = s.user_id
    where s.is_active and s.auto_renew and s.next_billing_on is not null and s.amount > 0
    for update of s
  loop
    v_today := (p_now at time zone r.tz)::date;
    v_due   := r.next_billing_on;
    v_guard := 0;

    while v_due <= v_today and v_guard < 60 loop
      if v_due >= v_today - 31
         and not exists (
           select 1 from public.transactions t
           where t.user_id = r.user_id and t.subscription_id = r.id
             and case when r.billing_cycle = 'weekly'
                   then (t.occurred_at at time zone r.tz)::date = v_due
                   else date_trunc('month', t.occurred_at at time zone r.tz) = date_trunc('month', v_due::timestamp)
                 end
         )
      then
        insert into public.transactions (user_id, type, amount, occurred_at, title, note, account_id, category_id, subscription_id)
        values (
          r.user_id, 'expense', r.amount, v_due::timestamp at time zone r.tz, r.name,
          'Recorded automatically' || case when r.currency <> r.home_currency then ' (billed in ' || r.currency || ')' else '' end,
          r.account_id, r.category_id, r.id
        );
        v_charges := v_charges + 1;
      end if;

      v_due := case r.billing_cycle
        when 'weekly'    then v_due + 7
        when 'monthly'   then (v_due + interval '1 month')::date
        when 'quarterly' then (v_due + interval '3 months')::date
        else                  (v_due + interval '1 year')::date
      end;
      v_guard := v_guard + 1;
    end loop;

    if v_due <> r.next_billing_on then
      update public.subscriptions set next_billing_on = v_due where id = r.id;
    end if;
  end loop;

  -- Debt instalments -----------------------------------------------------------------------------
  for r in
    select l.id, l.user_id, l.name, l.monthly_payment, l.starts_on, l.account_id,
           coalesce(l.due_day, extract(day from l.starts_on)::integer) as due_day,
           coalesce(p.timezone, 'Asia/Kuala_Lumpur')                   as tz,
           greatest(
             l.principal - l.opening_paid
               - coalesce((select sum(lp.amount) from public.liability_payments lp where lp.liability_id = l.id), 0),
             0
           ) as outstanding
    from public.liabilities l
    left join public.profiles p on p.id = l.user_id
    where l.status = 'active' and l.monthly_payment > 0
      and coalesce(l.due_day, extract(day from l.starts_on)::integer) is not null
    for update of l
  loop
    v_today       := (p_now at time zone r.tz)::date;
    v_month_start := date_trunc('month', v_today)::date;
    -- A due day past the end of a short month falls on its last day.
    v_due := v_month_start
             + (least(r.due_day, extract(day from (v_month_start + interval '1 month' - interval '1 day'))::integer) - 1);

    continue when v_today < v_due;
    continue when r.starts_on is not null and r.starts_on > v_due;
    continue when r.outstanding <= 0;
    continue when exists (
      select 1 from public.liability_payments lp
      where lp.liability_id = r.id and lp.paid_on >= v_month_start and lp.paid_on < (v_month_start + interval '1 month')::date
    );

    v_amount := least(r.monthly_payment, r.outstanding);

    insert into public.transactions (user_id, type, amount, occurred_at, title, note, account_id)
    values (r.user_id, 'expense', v_amount, v_due::timestamp at time zone r.tz, r.name || ' payment', 'Recorded automatically', r.account_id)
    returning id into v_tx;

    insert into public.liability_payments (user_id, liability_id, paid_on, amount, transaction_id, note)
    values (r.user_id, r.id, v_due, v_amount, v_tx, 'Recorded automatically');

    if r.outstanding - v_amount <= 0 then
      update public.liabilities set status = 'paid_off' where id = r.id;
    end if;
    v_payments := v_payments + 1;
  end loop;

  return jsonb_build_object('subscription_charges', v_charges, 'debt_payments', v_payments, 'ran_at', p_now);
end;
$$;

revoke execute on function public.post_due_recurring(timestamptz) from public, anon, authenticated;

-- Finance page: the same document as before plus paid_subscriptions and paid_liabilities, each a list of
-- { id, paid_on } for the month p_month (the caller's local month): the latest charge linked to each
-- subscription and the latest payment on each debt.
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
  with me as (
    select coalesce((select p.timezone from public.profiles p where p.id = (select auth.uid())), 'Asia/Kuala_Lumpur') as tz
  )
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
        select * from public.goals order by name limit 500) x), '[]'::jsonb),
    'paid_subscriptions', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select t.subscription_id as id, max((t.occurred_at at time zone me.tz)::date) as paid_on
        from public.transactions t, me
        where t.subscription_id is not null
          and (t.occurred_at at time zone me.tz)::date >= p_month
          and (t.occurred_at at time zone me.tz)::date < (p_month + interval '1 month')::date
        group by t.subscription_id) x), '[]'::jsonb),
    'paid_liabilities', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select lp.liability_id as id, max(lp.paid_on) as paid_on
        from public.liability_payments lp
        where lp.paid_on >= p_month and lp.paid_on < (p_month + interval '1 month')::date
        group by lp.liability_id) x), '[]'::jsonb)
  );
$$;

-- Vehicles page: latest 100 fill-ups, services and parking sessions (was 15 each).
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
        select * from public.fuel_logs order by filled_at desc limit 100) x), '[]'::jsonb),
    'maintenance', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.maintenance_logs order by performed_on desc limit 100) x), '[]'::jsonb),
    'parking', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.parking_logs order by started_at desc limit 100) x), '[]'::jsonb),
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

-- Fitness page: latest 100 workouts, bookings, matches and range sessions (was 10 to 60).
create or replace function public.fitness_bundle(p_today date, p_from timestamptz, p_to timestamptz, p_daily_from date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'workouts', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.workouts order by performed_at desc limit 100) x), '[]'::jsonb),
    'match_results', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.racket_match_results order by played_at desc limit 500) x), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.court_bookings order by starts_at desc limit 100) x), '[]'::jsonb),
    'shooting_sessions', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.shooting_sessions order by session_at desc limit 100) x), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.racket_matches order by played_at desc limit 100) x), '[]'::jsonb),
    'exercise_goals', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.exercise_goals order by created_at limit 100) x), '[]'::jsonb),
    'daily_exercise', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.daily_exercise where day >= p_daily_from and day <= p_today) x), '[]'::jsonb),
    'today_logs', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from public.exercise_logs where logged_at >= p_from and logged_at < p_to order by logged_at desc limit 200) x), '[]'::jsonb)
  );
$$;
