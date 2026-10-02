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
