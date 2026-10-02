-- ============================================================================
-- Nexa · MASTER SCHEMA
-- Paste into Supabase Dashboard -> SQL Editor and run ONCE on a fresh project.
--
-- Contents (in order): base + profiles, finance core, projects & inventory,
-- transactions, vehicles, nutrition & hydration, fitness & sports,
-- triggers & grants, daily exercise goals. RLS is enabled on every table.
--
-- Runs in a single transaction: if anything fails, nothing is applied.
-- NOT idempotent: re-running on a database that already has the schema will
-- fail with "already exists" (and roll back harmlessly).
-- Generated from supabase/migrations/*.sql — edit those, then rebuild this file.
-- ============================================================================

begin;


-- ----------------------------------------------------------------------------
-- 20261002000100_base.sql
-- ----------------------------------------------------------------------------

-- 01 · Base: shared helpers + profiles
-- Conventions for every table in this schema:
--   * id uuid pk, user_id uuid default auth.uid() -> auth.users (cascade)
--   * created_at / updated_at timestamptz (updated_at maintained by trigger, see last migration)
--   * RLS enabled + "Users see own data" policy
--   * parents expose unique (user_id, id) so children can use composite FKs
--     (user_id, parent_id) and can never reference another user's rows.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  currency     char(3) not null default 'MYR',
  timezone     text not null default 'Asia/Kuala_Lumpur',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users see own data" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Auto-create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 20261002000200_finance_core.sql
-- ----------------------------------------------------------------------------

-- 02 · Finance & Wealth (core): accounts, categories, books, liabilities,
-- subscriptions, assets + valuations, goals.
-- Ported from finance-mobile: book, liability, subscription, goal, monthly_goal, portfolio.

-- Where money lives (replaces the free-text "payment_method" arrays on book).
create table public.finance_accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null,
  kind            text not null default 'bank'
                    check (kind in ('cash', 'bank', 'ewallet', 'credit_card', 'savings', 'other')),
  currency        char(3) not null default 'MYR',
  opening_balance numeric(14, 2) not null default 0,
  colour          text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, name)
);

-- Replaces per-book category_cashin / category_cashout arrays.
-- `bucket` groups spend for reporting, incl. digital overhead + cloud subscriptions.
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  kind       text not null check (kind in ('income', 'expense')),
  bucket     text not null default 'general'
               check (bucket in (
                 'general', 'housing', 'utilities', 'food', 'transport', 'vehicle',
                 'health', 'fitness', 'sports', 'hardware', 'prototyping',
                 'digital_overhead', 'cloud_subscription', 'insurance', 'debt', 'other'
               )),
  colour     text,
  icon       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, kind, name)
);

-- Period-scoped ledgers ("cashbooks"), as in the mobile app.
create table public.books (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  starts_on   date,
  ends_on     date,
  colour      text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

-- Recurring liabilities incl. hardware installment plans.
-- Mobile app stored `outstanding` by hand; here it is derived (view liability_balances).
create table public.liabilities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null,
  kind             text not null default 'loan'
                     check (kind in ('loan', 'hardware_installment', 'credit_card', 'bnpl', 'other')),
  lender           text,
  principal        numeric(14, 2) not null check (principal >= 0),
  opening_paid     numeric(14, 2) not null default 0 check (opening_paid >= 0), -- repaid before tracking began
  interest_rate_pct numeric(6, 3) not null default 0 check (interest_rate_pct >= 0),
  term_months      integer check (term_months > 0),
  monthly_payment  numeric(14, 2) not null check (monthly_payment >= 0),
  starts_on        date,
  due_day          smallint check (due_day between 1 and 31),
  status           text not null default 'active' check (status in ('active', 'paid_off', 'defaulted')),
  account_id       uuid,
  colour           text,
  icon             text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, account_id) references public.finance_accounts (user_id, id)
    on delete set null (account_id)
);

-- Recurring digital overhead & cloud subscriptions.
create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null,
  kind            text not null default 'saas'
                    check (kind in (
                      'cloud_infra', 'saas', 'ai_api', 'domain_hosting', 'software_license',
                      'streaming', 'telco_internet', 'membership', 'other'
                    )),
  vendor          text,
  amount          numeric(14, 2) not null check (amount >= 0),
  currency        char(3) not null default 'MYR',
  billing_cycle   text not null default 'monthly'
                    check (billing_cycle in ('weekly', 'monthly', 'quarterly', 'yearly')),
  monthly_cost    numeric(14, 2) generated always as (
                    round(case billing_cycle
                      when 'weekly'    then amount * 52 / 12
                      when 'monthly'   then amount
                      when 'quarterly' then amount / 3
                      when 'yearly'    then amount / 12
                    end, 2)
                  ) stored,
  next_billing_on date,
  started_on      date,
  cancelled_on    date,
  auto_renew      boolean not null default true,
  is_active       boolean not null default true,
  account_id      uuid,
  category_id     uuid,
  colour          text,
  icon            text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, account_id) references public.finance_accounts (user_id, id)
    on delete set null (account_id),
  foreign key (user_id, category_id) references public.categories (user_id, id)
    on delete set null (category_id)
);

-- Asset ledger (replaces `portfolio`; its current_value JSONB history becomes asset_valuations).
create table public.assets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null,
  kind            text not null default 'other'
                    check (kind in ('cash', 'stock', 'fund', 'crypto', 'gold', 'property', 'vehicle', 'device', 'other')),
  code            text,                                    -- ticker / fund code
  purchased_on    date,
  amount_invested numeric(14, 2) not null default 0 check (amount_invested >= 0),
  disposed_on     date,
  colour          text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, id)
);

create table public.asset_valuations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset_id   uuid not null,
  valued_on  date not null default current_date,
  value      numeric(14, 2) not null check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, valued_on),
  foreign key (user_id, asset_id) references public.assets (user_id, id) on delete cascade
);

-- Savings / payoff goals (mobile: goal).
create table public.goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null,
  kind           text not null default 'savings'
                   check (kind in ('savings', 'emergency_fund', 'purchase', 'debt_payoff')),
  target_amount  numeric(14, 2) not null check (target_amount >= 0),
  current_amount numeric(14, 2) not null default 0 check (current_amount >= 0),
  target_date    date,
  is_completed   boolean not null default false,
  colour         text,
  icon           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, id)
);

-- Per-month income target and expense limit (mobile: monthly_goal). `month` is the 1st.
create table public.monthly_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month          date not null check (extract(day from month) = 1),
  income_target  numeric(14, 2) not null default 0 check (income_target >= 0),
  expense_limit  numeric(14, 2) not null default 0 check (expense_limit >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, month)
);

-- Indexes on FK / lookup columns
create index on public.liabilities (user_id, status);
create index on public.liabilities (user_id, account_id);
create index on public.subscriptions (user_id, is_active, next_billing_on);
create index on public.subscriptions (user_id, category_id);
create index on public.asset_valuations (user_id, asset_id, valued_on desc);

-- RLS
alter table public.finance_accounts enable row level security;
create policy "Users see own data" on public.finance_accounts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.categories enable row level security;
create policy "Users see own data" on public.categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.books enable row level security;
create policy "Users see own data" on public.books for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.liabilities enable row level security;
create policy "Users see own data" on public.liabilities for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.subscriptions enable row level security;
create policy "Users see own data" on public.subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.assets enable row level security;
create policy "Users see own data" on public.assets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.asset_valuations enable row level security;
create policy "Users see own data" on public.asset_valuations for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.goals enable row level security;
create policy "Users see own data" on public.goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.monthly_goals enable row level security;
create policy "Users see own data" on public.monthly_goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);


-- ----------------------------------------------------------------------------
-- 20261002000300_projects_inventory.sql
-- ----------------------------------------------------------------------------

-- 03 · Prototyping & Project Inventory
-- Electronics, SBCs, DIY builds. Parts are tracked once (inventory_items) and
-- allocated to builds through a bill of materials (project_components).
-- Project expense tags: projects.expense_tag + transactions.project_id (next migration).

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  expense_tag  text not null check (expense_tag ~ '^[a-z0-9][a-z0-9_-]*$'),
  status       text not null default 'idea'
                 check (status in ('idea', 'active', 'paused', 'done', 'abandoned')),
  description  text,
  budget       numeric(14, 2) check (budget >= 0),
  started_on   date,
  completed_on date,
  colour       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, expense_tag),
  check (completed_on is null or started_on is null or completed_on >= started_on)
);

create table public.inventory_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null,
  category       text not null default 'other'
                   check (category in (
                     'sbc', 'microcontroller', 'sensor', 'module', 'display', 'power',
                     'passive', 'connector', 'cable', 'enclosure', 'tool', 'storage', 'networking', 'other'
                   )),
  manufacturer   text,
  model          text,
  sku            text,
  serial_number  text,
  quantity       integer not null default 1 check (quantity >= 0),
  reorder_level  integer not null default 0 check (reorder_level >= 0),
  unit_cost      numeric(14, 2) not null default 0 check (unit_cost >= 0),
  status         text not null default 'in_stock'
                   check (status in ('in_stock', 'in_use', 'reserved', 'broken', 'sold')),
  location       text,
  vendor         text,
  product_url    text,
  purchased_on   date,
  warranty_until date,
  specs          jsonb not null default '{}'::jsonb,
  notes          text,
  liability_id   uuid,              -- hardware bought on an installment plan
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, liability_id) references public.liabilities (user_id, id)
    on delete set null (liability_id)
);

create table public.project_components (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  item_id    uuid not null,
  quantity   integer not null default 1 check (quantity > 0),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, item_id),
  foreign key (user_id, project_id) references public.projects (user_id, id) on delete cascade,
  foreign key (user_id, item_id) references public.inventory_items (user_id, id) on delete cascade
);

create index on public.projects (user_id, status);
create index on public.inventory_items (user_id, category);
create index on public.inventory_items (user_id, status);
create index on public.inventory_items (user_id, liability_id);
create index on public.project_components (user_id, item_id);

alter table public.projects enable row level security;
create policy "Users see own data" on public.projects for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.inventory_items enable row level security;
create policy "Users see own data" on public.inventory_items for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.project_components enable row level security;
create policy "Users see own data" on public.project_components for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);


-- ----------------------------------------------------------------------------
-- 20261002000400_transactions.sql
-- ----------------------------------------------------------------------------

-- 04 · Transactions, liability payments, finance views
-- Mobile app kept transactions as a JSONB array inside one row; here each is a row
-- so it can be indexed, aggregated in SQL, and linked to projects / subscriptions.

create table public.transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type              text not null check (type in ('income', 'expense')),
  amount            numeric(14, 2) not null check (amount > 0),
  occurred_at       timestamptz not null default now(),
  title             text not null,
  note              text,
  account_id        uuid,
  category_id       uuid,
  book_id           uuid,
  project_id        uuid,   -- project expense tag
  subscription_id   uuid,   -- charge belongs to a recurring subscription
  inventory_item_id uuid,   -- purchase of a specific part
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, account_id) references public.finance_accounts (user_id, id)
    on delete set null (account_id),
  foreign key (user_id, category_id) references public.categories (user_id, id)
    on delete set null (category_id),
  foreign key (user_id, book_id) references public.books (user_id, id)
    on delete set null (book_id),
  foreign key (user_id, project_id) references public.projects (user_id, id)
    on delete set null (project_id),
  foreign key (user_id, subscription_id) references public.subscriptions (user_id, id)
    on delete set null (subscription_id),
  foreign key (user_id, inventory_item_id) references public.inventory_items (user_id, id)
    on delete set null (inventory_item_id)
);

create table public.liability_payments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  liability_id   uuid not null,
  paid_on        date not null default current_date,
  amount         numeric(14, 2) not null check (amount > 0),
  transaction_id uuid,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (user_id, liability_id) references public.liabilities (user_id, id) on delete cascade,
  foreign key (user_id, transaction_id) references public.transactions (user_id, id)
    on delete set null (transaction_id)
);

create index on public.transactions (user_id, occurred_at desc);
create index on public.transactions (user_id, account_id);
create index on public.transactions (user_id, category_id);
create index on public.transactions (user_id, book_id);
create index on public.transactions (user_id, project_id) where project_id is not null;
create index on public.transactions (user_id, subscription_id) where subscription_id is not null;
create index on public.liability_payments (user_id, liability_id, paid_on desc);

alter table public.transactions enable row level security;
create policy "Users see own data" on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.liability_payments enable row level security;
create policy "Users see own data" on public.liability_payments for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- views
-- security_invoker: views run with the caller's rights, so RLS on the base tables applies.

create view public.liability_balances with (security_invoker = true) as
select
  l.id as liability_id,
  l.user_id,
  l.name,
  l.kind,
  l.principal,
  l.monthly_payment,
  l.opening_paid + coalesce(p.paid, 0)                                  as total_paid,
  greatest(l.principal - l.opening_paid - coalesce(p.paid, 0), 0)       as outstanding,
  case when l.monthly_payment > 0
       then ceil(greatest(l.principal - l.opening_paid - coalesce(p.paid, 0), 0) / l.monthly_payment)::int
  end                                                                   as months_remaining
from public.liabilities l
left join (
  select liability_id, sum(amount) as paid from public.liability_payments group by liability_id
) p on p.liability_id = l.id;

create view public.asset_latest_values with (security_invoker = true) as
select
  a.id as asset_id,
  a.user_id,
  a.name,
  a.kind,
  a.amount_invested,
  coalesce(v.value, a.amount_invested) as current_value,
  v.valued_on
from public.assets a
left join lateral (
  select av.value, av.valued_on
  from public.asset_valuations av
  where av.asset_id = a.id
  order by av.valued_on desc
  limit 1
) v on true
where a.disposed_on is null;

create view public.net_worth with (security_invoker = true) as
select
  u.user_id,
  coalesce(a.total, 0)                        as total_assets,
  coalesce(l.total, 0)                        as total_liabilities,
  coalesce(a.total, 0) - coalesce(l.total, 0) as net_worth
from (
  select user_id from public.assets
  union
  select user_id from public.liabilities
) u
left join (select user_id, sum(current_value) as total from public.asset_latest_values group by user_id) a
  on a.user_id = u.user_id
left join (select user_id, sum(outstanding) as total from public.liability_balances group by user_id) l
  on l.user_id = u.user_id;

-- Month buckets use the user's own timezone from profiles.
create view public.monthly_cashflow with (security_invoker = true) as
select
  t.user_id,
  date_trunc('month', t.occurred_at at time zone p.timezone)::date                  as month,
  coalesce(sum(t.amount) filter (where t.type = 'income'), 0)                        as income,
  coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)                       as expense,
  coalesce(sum(t.amount) filter (where t.type = 'income'), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)                   as net
from public.transactions t
join public.profiles p on p.id = t.user_id
group by t.user_id, 2;

create view public.project_cost_summary with (security_invoker = true) as
select
  pr.id as project_id,
  pr.user_id,
  pr.name,
  pr.expense_tag,
  pr.status,
  pr.budget,
  coalesce(e.spent, 0)                                   as spent,
  pr.budget - coalesce(e.spent, 0)                       as budget_remaining,
  coalesce(b.bom_value, 0)                               as bom_value,
  coalesce(b.bom_lines, 0)                               as bom_lines
from public.projects pr
left join (
  select project_id, sum(amount) as spent
  from public.transactions where type = 'expense' and project_id is not null
  group by project_id
) e on e.project_id = pr.id
left join (
  select pc.project_id, sum(pc.quantity * i.unit_cost) as bom_value, count(*) as bom_lines
  from public.project_components pc
  join public.inventory_items i on i.id = pc.item_id
  group by pc.project_id
) b on b.project_id = pr.id;


-- ----------------------------------------------------------------------------
-- 20261002000500_vehicles.sql
-- ----------------------------------------------------------------------------

-- 05 · Vehicle & Logistics
-- Costs live on the log rows; transaction_id optionally links the matching ledger entry.

create table public.vehicles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                text not null,
  make                text,
  model               text,
  year                smallint check (year between 1950 and 2100),
  plate_number        text,
  fuel_type           text not null default 'ron95'
                        check (fuel_type in ('ron95', 'ron97', 'diesel', 'hybrid', 'ev', 'other')),
  tank_capacity_l     numeric(6, 2) check (tank_capacity_l > 0),
  initial_odometer_km integer not null default 0 check (initial_odometer_km >= 0),
  purchased_on        date,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, id)
);

create table public.odometer_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id  uuid not null,
  logged_at   timestamptz not null default now(),
  odometer_km integer not null check (odometer_km >= 0),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (user_id, vehicle_id) references public.vehicles (user_id, id) on delete cascade
);

create table public.fuel_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id      uuid not null,
  filled_at       timestamptz not null default now(),
  odometer_km     integer not null check (odometer_km >= 0),
  liters          numeric(8, 3) not null check (liters > 0),
  price_per_liter numeric(8, 3) not null check (price_per_liter >= 0),
  total_cost      numeric(12, 2) not null check (total_cost >= 0),
  is_full_tank    boolean not null default true,
  station         text,
  fuel_grade      text,
  transaction_id  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (user_id, vehicle_id) references public.vehicles (user_id, id) on delete cascade,
  foreign key (user_id, transaction_id) references public.transactions (user_id, id)
    on delete set null (transaction_id)
);

create table public.maintenance_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id       uuid not null,
  performed_on     date not null default current_date,
  odometer_km      integer check (odometer_km >= 0),
  kind             text not null default 'service'
                     check (kind in (
                       'service', 'oil_change', 'tyres', 'brakes', 'battery', 'repair',
                       'inspection', 'road_tax', 'insurance', 'accessories', 'other'
                     )),
  description      text,
  workshop         text,
  cost             numeric(12, 2) not null default 0 check (cost >= 0),
  next_due_km      integer check (next_due_km >= 0),
  next_due_on      date,
  transaction_id   uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (user_id, vehicle_id) references public.vehicles (user_id, id) on delete cascade,
  foreign key (user_id, transaction_id) references public.transactions (user_id, id)
    on delete set null (transaction_id)
);

-- Municipal parking history.
create table public.parking_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id     uuid not null,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  authority      text,            -- e.g. municipal council
  location       text,
  zone           text,
  payment_method text,            -- coupon, app, meter, ...
  cost           numeric(12, 2) not null default 0 check (cost >= 0),
  transaction_id uuid,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  foreign key (user_id, vehicle_id) references public.vehicles (user_id, id) on delete cascade,
  foreign key (user_id, transaction_id) references public.transactions (user_id, id)
    on delete set null (transaction_id)
);

create index on public.odometer_logs (user_id, vehicle_id, logged_at desc);
create index on public.fuel_logs (user_id, vehicle_id, filled_at desc);
create index on public.fuel_logs (user_id, transaction_id) where transaction_id is not null;
create index on public.maintenance_logs (user_id, vehicle_id, performed_on desc);
create index on public.maintenance_logs (user_id, transaction_id) where transaction_id is not null;
create index on public.parking_logs (user_id, vehicle_id, started_at desc);
create index on public.parking_logs (user_id, transaction_id) where transaction_id is not null;

alter table public.vehicles enable row level security;
create policy "Users see own data" on public.vehicles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.odometer_logs enable row level security;
create policy "Users see own data" on public.odometer_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.fuel_logs enable row level security;
create policy "Users see own data" on public.fuel_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.maintenance_logs enable row level security;
create policy "Users see own data" on public.maintenance_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.parking_logs enable row level security;
create policy "Users see own data" on public.parking_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- views

-- Full-tank method. A segment runs from one full fill to the next full fill; partial fills
-- in between add to its liters. Segment k = rows that have exactly k full fills before them.
-- Segment 0 has no known starting point, and a segment with no closing full fill is incomplete.
create view public.vehicle_fuel_segments with (security_invoker = true) as
with ordered as (
  select
    f.*,
    count(*) filter (where f.is_full_tank) over (
      partition by f.vehicle_id
      order by f.odometer_km, f.filled_at
      rows between unbounded preceding and 1 preceding
    ) as prior_full
  from public.fuel_logs f
),
fulls as (
  select
    vehicle_id,
    odometer_km,
    row_number() over (partition by vehicle_id order by odometer_km, filled_at) as rn
  from public.fuel_logs
  where is_full_tank
),
segments as (
  select
    o.user_id,
    o.vehicle_id,
    s.odometer_km                 as start_odometer_km,
    max(o.odometer_km)            as end_odometer_km,
    max(o.filled_at)              as ended_at,
    sum(o.liters)                 as liters,
    sum(o.total_cost)             as cost
  from ordered o
  join fulls s on s.vehicle_id = o.vehicle_id and s.rn = o.prior_full
  where o.prior_full >= 1
  group by o.user_id, o.vehicle_id, o.prior_full, s.odometer_km
  having bool_or(o.is_full_tank)
)
select
  user_id,
  vehicle_id,
  start_odometer_km,
  end_odometer_km,
  ended_at,
  end_odometer_km - start_odometer_km                                                 as distance_km,
  liters,
  cost,
  round((end_odometer_km - start_odometer_km) / nullif(liters, 0), 2)                 as km_per_liter,
  round(liters * 100 / nullif(end_odometer_km - start_odometer_km, 0), 2)             as liters_per_100km,
  round(cost / nullif(end_odometer_km - start_odometer_km, 0), 3)                     as fuel_cost_per_km
from segments;

-- Lifetime running cost per vehicle. Distance = highest odometer seen anywhere - initial odometer.
create view public.vehicle_running_costs with (security_invoker = true) as
select
  v.user_id,
  v.id as vehicle_id,
  v.name,
  coalesce(f.cost, 0)                                                         as fuel_cost,
  coalesce(m.cost, 0)                                                         as maintenance_cost,
  coalesce(p.cost, 0)                                                         as parking_cost,
  coalesce(f.cost, 0) + coalesce(m.cost, 0) + coalesce(p.cost, 0)             as total_cost,
  greatest(v.initial_odometer_km, f.max_odo, m.max_odo, o.max_odo)            as current_odometer_km,
  greatest(v.initial_odometer_km, f.max_odo, m.max_odo, o.max_odo)
    - v.initial_odometer_km                                                   as distance_km,
  round(
    (coalesce(f.cost, 0) + coalesce(m.cost, 0) + coalesce(p.cost, 0))
    / nullif(greatest(v.initial_odometer_km, f.max_odo, m.max_odo, o.max_odo) - v.initial_odometer_km, 0)
  , 3)                                                                        as cost_per_km
from public.vehicles v
left join (select vehicle_id, sum(total_cost) as cost, max(odometer_km) as max_odo
           from public.fuel_logs group by vehicle_id) f on f.vehicle_id = v.id
left join (select vehicle_id, sum(cost) as cost, max(odometer_km) as max_odo
           from public.maintenance_logs group by vehicle_id) m on m.vehicle_id = v.id
left join (select vehicle_id, sum(cost) as cost
           from public.parking_logs group by vehicle_id) p on p.vehicle_id = v.id
left join (select vehicle_id, max(odometer_km) as max_odo
           from public.odometer_logs group by vehicle_id) o on o.vehicle_id = v.id;


-- ----------------------------------------------------------------------------
-- 20261002000600_nutrition_hydration.sql
-- ----------------------------------------------------------------------------

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


-- ----------------------------------------------------------------------------
-- 20261002000700_fitness_sports.sql
-- ----------------------------------------------------------------------------

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


-- ----------------------------------------------------------------------------
-- 20261002000800_triggers_grants.sql
-- ----------------------------------------------------------------------------

-- 08 · updated_at triggers + grants
-- Attaches set_updated_at() to every public base table that has an updated_at column.
-- Re-run this block (or add a trigger by hand) when you create new tables later.

do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- Newer Supabase projects do not auto-expose new public tables to the Data API.
-- RLS (enabled on every table) is what actually limits rows; anon gets nothing.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;


-- ----------------------------------------------------------------------------
-- 20261002000900_exercise_goals.sql
-- ----------------------------------------------------------------------------

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


-- ----------------------------------------------------------------------------
-- 20261002001000_performance.sql
-- ----------------------------------------------------------------------------

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


commit;
