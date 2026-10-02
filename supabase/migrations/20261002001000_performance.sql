-- 10 · Performance: foreign-key indexes and read RPCs
-- Indexes: the foreign keys the database linter reports as uncovered. Deleting or re-pointing a parent row
-- (a transaction, project, account or inventory item) otherwise scans the child table.
-- RPCs: each replaces several Data API round trips with one. Both are security invoker, so RLS still
-- decides which rows the caller sees; neither takes a user id.

create index if not exists court_bookings_user_id_transaction_id_idx
  on public.court_bookings (user_id, transaction_id) where transaction_id is not null;
create index if not exists liability_payments_user_id_transaction_id_idx
  on public.liability_payments (user_id, transaction_id) where transaction_id is not null;
create index if not exists shooting_sessions_user_id_transaction_id_idx
  on public.shooting_sessions (user_id, transaction_id) where transaction_id is not null;
create index if not exists transactions_user_id_inventory_item_id_idx
  on public.transactions (user_id, inventory_item_id) where inventory_item_id is not null;
create index if not exists project_components_user_id_project_id_idx
  on public.project_components (user_id, project_id);
create index if not exists subscriptions_user_id_account_id_idx
  on public.subscriptions (user_id, account_id);

-- The ledger is paged newest first; id breaks ties so a row never appears on two pages.
create index if not exists transactions_user_id_occurred_at_id_idx
  on public.transactions (user_id, occurred_at desc, id desc);
drop index if exists public.transactions_user_id_occurred_at_idx;

-- One month's income, spending and targets plus net worth: was three requests (monthly_cashflow,
-- monthly_goals, net_worth). Always returns exactly one row; missing parts come back as 0.
create or replace function public.finance_overview(p_month date)
returns table (
  income            numeric,
  expense           numeric,
  income_target     numeric,
  expense_limit     numeric,
  total_assets      numeric,
  total_liabilities numeric,
  net_worth         numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce((select c.income from public.monthly_cashflow c where c.month = p_month), 0),
    coalesce((select c.expense from public.monthly_cashflow c where c.month = p_month), 0),
    coalesce((select g.income_target from public.monthly_goals g where g.month = p_month), 0),
    coalesce((select g.expense_limit from public.monthly_goals g where g.month = p_month), 0),
    coalesce((select n.total_assets from public.net_worth n), 0),
    coalesce((select n.total_liabilities from public.net_worth n), 0),
    coalesce((select n.net_worth from public.net_worth n), 0);
$$;

-- One page of the ledger, newest first, with the total row count for the pager:
-- { "total": 137, "rows": [ { ...transaction }, ... ] }
create or replace function public.transactions_page(p_limit integer default 20, p_offset integer default 0)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.transactions),
    'rows', coalesce(
      (
        select jsonb_agg(to_jsonb(page) order by page.occurred_at desc, page.id desc)
        from (
          select t.*
          from public.transactions t
          order by t.occurred_at desc, t.id desc
          limit least(greatest(coalesce(p_limit, 20), 1), 100)
          offset greatest(coalesce(p_offset, 0), 0)
        ) page
      ),
      '[]'::jsonb
    )
  );
$$;

-- Functions are executable by everyone by default: signed-in users only.
revoke execute on function public.finance_overview(date) from public, anon;
revoke execute on function public.transactions_page(integer, integer) from public, anon;
grant execute on function public.finance_overview(date) to authenticated;
grant execute on function public.transactions_page(integer, integer) to authenticated;
