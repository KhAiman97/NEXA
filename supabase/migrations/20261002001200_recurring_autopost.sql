-- 12 · Recurring charges post themselves
-- A daily job records what fell due: subscription charges and debt instalments become transactions
-- without anyone opening the app. post_due_recurring() does the work; pg_cron runs it once a day.
--
-- Subscriptions: active, auto-renewing, with a next billing date. Each due date becomes one expense
-- (same account and category as the subscription) and the date moves on by one billing cycle.
-- Debts: active, with a monthly payment and a due day (or a start date to take the day from). Once the
-- due day arrives, the month's instalment is recorded as a payment plus a matching expense, unless a
-- payment was already recorded that month, by hand or by an earlier run.
--
-- Safe to run more than once a day: the billing date advances and the month's payment exists, so a
-- second run finds nothing to do. If the job misses days it catches up, but only charges that fell
-- due in the last 31 days are posted; older ones are skipped and the date still moves on.
-- "Today" is each user's local date.

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
             and (t.occurred_at at time zone r.tz)::date = v_due
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

-- It writes for every user, so only the scheduler (the database owner) may run it.
revoke execute on function public.post_due_recurring(timestamptz) from public, anon, authenticated;

-- Once a day at 00:05 Malaysia time (16:05 UTC). Skipped where pg_cron does not exist (local test databases).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'nexa-post-due-recurring';
    perform cron.schedule('nexa-post-due-recurring', '5 16 * * *', 'select public.post_due_recurring()');
  end if;
end;
$$;
