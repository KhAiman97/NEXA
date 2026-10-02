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
